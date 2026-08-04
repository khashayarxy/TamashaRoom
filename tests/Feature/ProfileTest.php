<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\SubtitleTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get('/profile');

        $response->assertOk();
    }

    public function test_profile_information_can_be_updated(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => 'test@example.com',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/profile');

        $user->refresh();

        $this->assertSame('Test User', $user->name);
        $this->assertSame('test@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
    }

    public function test_email_verification_status_is_unchanged_when_the_email_address_is_unchanged(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => $user->email,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/profile');

        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_user_can_delete_their_account(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->delete('/profile', [
                'password' => 'password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/');

        $this->assertGuest();
        $this->assertNull($user->fresh());
    }

    public function test_correct_password_must_be_provided_to_delete_account(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->delete('/profile', [
                'password' => 'wrong-password',
            ]);

        $response
            ->assertSessionHasErrors('password')
            ->assertRedirect('/profile');

        $this->assertNotNull($user->fresh());
    }

    public function test_deleting_account_removes_subtitle_files_of_owned_rooms(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();

        $room = Room::factory()->create([
            'user_id' => $user->id,
            'name' => 'Room With Subtitles',
            'invite_code' => 'DELETEME',
            'max_members' => 10,
        ]);

        $track = SubtitleTrack::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'label' => 'Persian',
            'language' => 'fa',
            'file_path' => 'subtitles/1/orphaned.vtt',
            'original_extension' => 'vtt',
        ]);

        Storage::disk('local')->put($track->file_path, 'WEBVTT');

        $this->assertTrue(Storage::disk('local')->exists($track->file_path));

        $this
            ->actingAs($user)
            ->delete('/profile', [
                'password' => 'password',
            ]);

        $this->assertGuest();
        $this->assertNull($user->fresh());
        $this->assertDatabaseMissing('rooms', ['id' => $room->id]);
        $this->assertFalse(Storage::disk('local')->exists($track->file_path));
    }

    public function test_deleting_account_removes_subtitle_files_from_all_owned_rooms(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();

        $paths = [];

        foreach ([1, 2] as $index) {
            $room = Room::factory()->create([
                'user_id' => $user->id,
                'name' => "Owned Room {$index}",
                'invite_code' => "OWNED0{$index}",
                'max_members' => 10,
            ]);

            $track = SubtitleTrack::create([
                'room_id' => $room->id,
                'user_id' => $user->id,
                'label' => "Persian {$index}",
                'language' => 'fa',
                'file_path' => "subtitles/{$room->id}/track.vtt",
                'original_extension' => 'vtt',
            ]);

            Storage::disk('local')->put($track->file_path, 'WEBVTT');
            $paths[] = $track->file_path;
        }

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'password']);

        $this->assertGuest();
        $this->assertNull($user->fresh());

        foreach ($paths as $path) {
            $this->assertFalse(Storage::disk('local')->exists($path));
        }
    }

    public function test_deleting_account_does_not_remove_other_users_room_files(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $otherRoom = Room::factory()->create([
            'user_id' => $otherUser->id,
            'name' => 'Other Room',
            'invite_code' => 'OTHER123',
            'max_members' => 10,
        ]);

        $otherTrack = SubtitleTrack::create([
            'room_id' => $otherRoom->id,
            'user_id' => $otherUser->id,
            'label' => 'Persian',
            'language' => 'fa',
            'file_path' => 'subtitles/999/keep.vtt',
            'original_extension' => 'vtt',
        ]);

        Storage::disk('local')->put($otherTrack->file_path, 'WEBVTT');

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'password']);

        $this->assertGuest();
        $this->assertNull($user->fresh());
        $this->assertDatabaseHas('rooms', ['id' => $otherRoom->id]);
        $this->assertTrue(Storage::disk('local')->exists($otherTrack->file_path));
    }

    public function test_deleting_account_tolerates_missing_subtitle_files(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();

        $room = Room::factory()->create([
            'user_id' => $user->id,
            'name' => 'Missing Files Room',
            'invite_code' => 'MISSING1',
            'max_members' => 10,
        ]);

        SubtitleTrack::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'label' => 'Orphaned',
            'language' => 'fa',
            'file_path' => 'subtitles/777/never-written.vtt',
            'original_extension' => 'vtt',
        ]);

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'password']);

        $this->assertGuest();
        $this->assertNull($user->fresh());
        $this->assertDatabaseMissing('rooms', ['id' => $room->id]);
    }

    public function test_deleting_account_logs_failed_subtitle_file_deletions(): void
    {
        Log::shouldReceive('warning')->once();

        $user = User::factory()->create();

        $room = Room::factory()->create([
            'user_id' => $user->id,
            'name' => 'Delete Failure Room',
            'invite_code' => 'FAILURE1',
            'max_members' => 10,
        ]);

        SubtitleTrack::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'label' => 'Stubborn',
            'language' => 'fa',
            'file_path' => 'subtitles/888/stubborn.vtt',
            'original_extension' => 'vtt',
        ]);

        $disk = Mockery::mock();
        $disk->shouldReceive('exists')->andReturn(true);
        $disk->shouldReceive('delete')->andReturn(false);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'password']);

        $this->assertGuest();
        $this->assertNull($user->fresh());
        $this->assertDatabaseMissing('rooms', ['id' => $room->id]);
    }
}
