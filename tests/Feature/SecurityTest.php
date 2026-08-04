<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SecurityTest extends TestCase
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
            'is_locked' => false,
        ]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
            'presence_status' => 'online',
        ]);
    }

    // ─── Security Headers ────────────────────────────────────

    #[Test]
    public function authenticated_page_has_security_headers(): void
    {
        $response = $this->actingAs($this->owner)->get('/dashboard');

        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Permissions-Policy');
        $response->assertHeader('Content-Security-Policy');
    }

    #[Test]
    public function login_page_has_security_headers(): void
    {
        $response = $this->get('/login');

        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    #[Test]
    public function security_headers_are_not_leaking_server_info(): void
    {
        $response = $this->actingAs($this->owner)->get('/dashboard');

        $response->assertHeaderMissing('X-Powered-By');
    }

    // ─── File Upload MIME Validation ────────────────────────

    #[Test]
    public function rejects_srt_with_invalid_content(): void
    {
        $file = UploadedFile::fake()->createWithContent('fake.srt', 'This is not an SRT file');

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    #[Test]
    public function rejects_vtt_with_invalid_content(): void
    {
        $file = UploadedFile::fake()->createWithContent('fake.vtt', 'Not a VTT file at all');

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    #[Test]
    public function accepts_valid_srt_content(): void
    {
        $content = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n";
        $file = UploadedFile::fake()->createWithContent('valid.srt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertCreated();
    }

    #[Test]
    public function accepts_valid_vtt_content(): void
    {
        $content = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello\n";
        $file = UploadedFile::fake()->createWithContent('valid.vtt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertCreated();
    }

    #[Test]
    public function rejects_renamed_exe_as_srt(): void
    {
        $content = "MZ\x90\x00".str_repeat("\x00", 100);
        $file = UploadedFile::fake()->createWithContent('malicious.exe.srt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    #[Test]
    public function rejects_script_injection_as_vtt(): void
    {
        $content = "<script>alert('xss')</script>";
        $file = UploadedFile::fake()->createWithContent('xss.vtt', $content);

        $response = $this->actingAs($this->owner)
            ->post("/subtitles/{$this->room->id}", [
                'file' => $file,
            ]);

        $response->assertSessionHasErrors('file');
    }

    // ─── Authorization Consistency ──────────────────────────

    #[Test]
    public function playback_update_uses_policy_not_manual_check(): void
    {
        $response = $this->actingAs($this->member)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 10,
                'duration_seconds' => 120,
            ]);

        $response->assertForbidden();
    }

    #[Test]
    public function set_video_uses_policy_not_manual_check(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/new.mp4',
            ]);

        $response->assertForbidden();
    }

    #[Test]
    public function stranger_cannot_access_any_room_route(): void
    {
        $endpoints = [
            'get' => ["/rooms/{$this->room->id}", "/playback/{$this->room->id}/state"],
            'post' => ["/chat/{$this->room->id}/messages"],
        ];

        // Unauthorized room access must look identical to "not found" so the
        // room's existence is not disclosed (404, never 403).
        foreach ($endpoints['get'] as $uri) {
            $response = $this->actingAs($this->stranger)->getJson($uri);
            $response->assertNotFound();
        }

        foreach ($endpoints['post'] as $uri) {
            $response = $this->actingAs($this->stranger)
                ->postJson($uri, ['body' => 'test']);
            $response->assertNotFound();
        }
    }

    #[Test]
    public function stranger_cannot_access_video_proxy(): void
    {
        $response = $this->actingAs($this->stranger)
            ->getJson("/proxy/video/{$this->room->id}");

        $response->assertNotFound();
    }

    #[Test]
    public function member_cannot_kick_owner(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/kick/{$this->owner->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function member_cannot_transfer_ownership(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/transfer/{$this->owner->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function locked_room_prevents_stranger_join(): void
    {
        $this->room->update(['is_locked' => true]);

        $response = $this->actingAs($this->stranger)
            ->from(route('dashboard'))
            ->get("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHasErrors('invite_code');
    }

    // ─── Info Leakage ───────────────────────────────────────

    #[Test]
    public function error_response_does_not_leak_details(): void
    {
        config(['app.debug' => false]);

        $response = $this->actingAs($this->owner)
            ->getJson('/nonexistent-route');

        $response->assertStatus(404);
    }

    #[Test]
    public function video_proxy_rejects_ssrf_urls(): void
    {
        $this->room->update(['video_url' => 'http://localhost/video.mp4']);

        $response = $this->actingAs($this->owner)
            ->getJson("/proxy/video/{$this->room->id}");

        $response->assertStatus(400);
    }
}
