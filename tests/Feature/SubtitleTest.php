<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\SubtitleTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SubtitleTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private User $stranger;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        $this->member = User::factory()->create(['email_verified_at' => now()]);
        $this->stranger = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
        ]);
    }

    #[Test]
    public function owner_can_upload_srt_subtitle(): void
    {
        $content = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,000\nSecond cue";
        $file = UploadedFile::fake()->createWithContent('test.srt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertCreated()
            ->assertJson([
                'label' => 'test.srt',
                'original_extension' => 'srt',
            ]);

        $this->assertDatabaseHas('subtitle_tracks', [
            'room_id' => $this->room->id,
            'label' => 'test.srt',
        ]);
    }

    #[Test]
    public function owner_can_upload_vtt_subtitle(): void
    {
        $content = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nDirect VTT cue";
        $file = UploadedFile::fake()->createWithContent('test.vtt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertCreated();
        $this->assertDatabaseHas('subtitle_tracks', [
            'room_id' => $this->room->id,
            'original_extension' => 'vtt',
        ]);
    }

    #[Test]
    public function member_cannot_upload_subtitle(): void
    {
        $content = "1\n00:00:01,000 --> 00:00:04,000\nTest";
        $file = UploadedFile::fake()->createWithContent('test.srt', $content);

        $response = $this->actingAs($this->member)
            ->call('POST', "/subtitles/{$this->room->id}", [], [], ['file' => $file], ['HTTP_Accept' => 'application/json']);

        $response->assertForbidden();
    }

    #[Test]
    public function stranger_cannot_upload_subtitle(): void
    {
        $content = "1\n00:00:01,000 --> 00:00:04,000\nTest";
        $file = UploadedFile::fake()->createWithContent('test.srt', $content);

        $response = $this->actingAs($this->stranger)
            ->call('POST', "/subtitles/{$this->room->id}", [], [], ['file' => $file], ['HTTP_Accept' => 'application/json']);

        $response->assertForbidden();
    }

    #[Test]
    public function invalid_file_type_is_rejected(): void
    {
        $file = UploadedFile::fake()->create('test.txt', 100);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    #[Test]
    public function file_larger_than_2mb_is_rejected(): void
    {
        $file = UploadedFile::fake()->create('test.srt', 3000);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    #[Test]
    public function owner_can_list_subtitle_tracks(): void
    {
        SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Track 1',
            'language' => 'fa',
            'file_path' => 'subtitles/1/track1.vtt',
            'original_extension' => 'vtt',
        ]);
        SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Track 2',
            'language' => 'en',
            'file_path' => 'subtitles/1/track2.vtt',
            'original_extension' => 'srt',
        ]);

        $response = $this->actingAs($this->owner)
            ->getJson("/subtitles/{$this->room->id}");

        $response->assertOk()
            ->assertJsonCount(2);
    }

    #[Test]
    public function member_can_list_subtitle_tracks(): void
    {
        SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Track 1',
            'language' => 'fa',
            'file_path' => 'subtitles/1/track1.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->member)
            ->getJson("/subtitles/{$this->room->id}");

        $response->assertOk()
            ->assertJsonCount(1);
    }

    #[Test]
    public function stranger_cannot_list_subtitle_tracks(): void
    {
        $response = $this->actingAs($this->stranger)
            ->getJson("/subtitles/{$this->room->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function owner_can_delete_subtitle_track(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'To Delete',
            'language' => 'fa',
            'file_path' => 'subtitles/1/delete-me.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/subtitles/{$this->room->id}/{$track->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('subtitle_tracks', ['id' => $track->id]);
    }

    #[Test]
    public function member_cannot_delete_subtitle_track(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'To Delete',
            'language' => 'fa',
            'file_path' => 'subtitles/1/delete-me.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->member)
            ->deleteJson("/subtitles/{$this->room->id}/{$track->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function track_from_another_room_returns_404(): void
    {
        $otherRoom = Room::factory()->create(['user_id' => $this->owner->id]);
        $track = SubtitleTrack::create([
            'room_id' => $otherRoom->id,
            'user_id' => $this->owner->id,
            'label' => 'Other room',
            'language' => 'fa',
            'file_path' => 'subtitles/2/track.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->owner)
            ->getJson("/subtitles/{$this->room->id}/{$track->id}/cues");

        $response->assertNotFound();
    }

    #[Test]
    public function cues_endpoint_returns_parsed_cues(): void
    {
        $vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst cue\n\n00:00:05.500 --> 00:00:08.250\nSecond cue\nwith two lines";

        $file = UploadedFile::fake()->createWithContent('test.vtt', $vttContent);
        $upload = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", ['file' => $file]);
        $trackId = $upload->json('id');

        $response = $this->actingAs($this->member)
            ->getJson("/subtitles/{$this->room->id}/{$trackId}/cues");

        $response->assertOk()
            ->assertJson([
                'cues' => [
                    ['start' => 1000, 'end' => 4000, 'text' => 'First cue'],
                    ['start' => 5500, 'end' => 8250, 'text' => "Second cue\nwith two lines"],
                ],
            ]);
    }

    #[Test]
    public function show_endpoint_returns_vtt_content(): void
    {
        $vttContent = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nTest content";
        $file = UploadedFile::fake()->createWithContent('test.vtt', $vttContent);
        $upload = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", ['file' => $file]);
        $trackId = $upload->json('id');

        $response = $this->actingAs($this->member)
            ->get("/subtitles/{$this->room->id}/{$trackId}");

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/vtt; charset=utf-8');

        $content = $response->getContent();
        $this->assertStringContainsString('WEBVTT', $content);
        $this->assertStringContainsString('00:00:01.000 --> 00:00:04.000', $content);
        $this->assertStringContainsString('Test content', $content);
    }

    #[Test]
    public function uploaded_srt_with_script_payload_returns_sanitized_cues(): void
    {
        $srt = "1\n00:00:01,000 --> 00:00:04,000\n<script>alert('xss')</script> سلام <b>دنیا</b>";

        $file = UploadedFile::fake()->createWithContent('payload.srt', $srt);
        $upload = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", ['file' => $file]);
        $trackId = $upload->json('id');

        $response = $this->actingAs($this->member)
            ->getJson("/subtitles/{$this->room->id}/{$trackId}/cues");

        $response->assertOk();
        $cueText = $response->json('cues.0.text');
        $this->assertStringNotContainsString('<script', $cueText);
        $this->assertStringNotContainsString('</script>', $cueText);
        $this->assertStringNotContainsString('<b>', $cueText);
        $this->assertStringContainsString('سلام دنیا', $cueText);
    }

    #[Test]
    public function owner_can_set_room_default_subtitle(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/subtitles/{$this->room->id}/default", [
                'track_id' => $track->id,
            ]);

        $response->assertOk()
            ->assertJson(['default_track_id' => $track->id]);

        $this->assertDatabaseHas('rooms', [
            'id' => $this->room->id,
            'active_subtitle_track_id' => $track->id,
        ]);
    }

    #[Test]
    public function owner_can_clear_room_default_subtitle(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);

        $this->room->update(['active_subtitle_track_id' => $track->id]);

        $response = $this->actingAs($this->owner)
            ->postJson("/subtitles/{$this->room->id}/default", [
                'track_id' => null,
            ]);

        $response->assertOk()
            ->assertJson(['default_track_id' => null]);

        $this->assertDatabaseHas('rooms', [
            'id' => $this->room->id,
            'active_subtitle_track_id' => null,
        ]);
    }

    #[Test]
    public function member_cannot_set_room_default_subtitle(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->member)
            ->postJson("/subtitles/{$this->room->id}/default", [
                'track_id' => $track->id,
            ]);

        $response->assertForbidden();
    }

    #[Test]
    public function stranger_cannot_set_room_default_subtitle(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->stranger)
            ->postJson("/subtitles/{$this->room->id}/default", [
                'track_id' => $track->id,
            ]);

        $response->assertForbidden();
    }

    #[Test]
    public function setting_default_to_track_from_another_room_returns_404(): void
    {
        $otherRoom = Room::factory()->create(['user_id' => $this->owner->id]);
        $track = SubtitleTrack::create([
            'room_id' => $otherRoom->id,
            'user_id' => $this->owner->id,
            'label' => 'Other room',
            'language' => 'fa',
            'file_path' => 'subtitles/2/track.vtt',
            'original_extension' => 'vtt',
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/subtitles/{$this->room->id}/default", [
                'track_id' => $track->id,
            ]);

        $response->assertNotFound();
    }

    #[Test]
    public function member_can_read_room_default_subtitle(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);
        $this->room->update(['active_subtitle_track_id' => $track->id]);

        $response = $this->actingAs($this->member)
            ->getJson("/subtitles/{$this->room->id}/default");

        $response->assertOk()
            ->assertJson(['default_track_id' => $track->id]);
    }

    #[Test]
    public function stranger_cannot_read_room_default_subtitle(): void
    {
        $response = $this->actingAs($this->stranger)
            ->getJson("/subtitles/{$this->room->id}/default");

        $response->assertForbidden();
    }

    #[Test]
    public function deleting_default_track_clears_room_default(): void
    {
        $track = SubtitleTrack::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'label' => 'Default track',
            'language' => 'fa',
            'file_path' => 'subtitles/1/default.vtt',
            'original_extension' => 'vtt',
        ]);
        $this->room->update(['active_subtitle_track_id' => $track->id]);

        $response = $this->actingAs($this->owner)
            ->deleteJson("/subtitles/{$this->room->id}/{$track->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('subtitle_tracks', ['id' => $track->id]);
        $this->assertDatabaseHas('rooms', [
            'id' => $this->room->id,
            'active_subtitle_track_id' => null,
        ]);
    }

    #[Test]
    public function stored_vtt_is_served_with_text_vtt_content_type_not_html(): void
    {
        $vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<img src=x onerror=\"alert(1)\"> payload";

        $file = UploadedFile::fake()->createWithContent('payload.vtt', $vtt);
        $upload = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", ['file' => $file]);
        $trackId = $upload->json('id');

        $response = $this->actingAs($this->member)
            ->get("/subtitles/{$this->room->id}/{$trackId}");

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/vtt; charset=utf-8');
        $this->assertNotSame('text/html', $response->headers->get('Content-Type'));
    }
}
