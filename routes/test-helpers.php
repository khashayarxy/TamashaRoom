<?php

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\SubtitleTrack;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * A globally-unique email for E2E/test-helper users.
 *
 * The default UserFactory uses faker's unique()->safeEmail(), but faker's
 * "unique" state only lives for the current PHP process. Under `php artisan
 * serve` the application is rebuilt per request, so the unique set resets
 * every request — and the dev/E2E database accumulates users across runs.
 * That combination periodically produced a UNIQUE constraint violation on
 * users.email (a 500 that made E2E helper calls flaky). A random suffix is
 * collision-proof regardless of how many users the database already holds.
 */
if (! function_exists('test_helper_user_email')) {
    function test_helper_user_email(): string
    {
        return 'e2e-'.Str::random(12).'@example.com';
    }
}

Route::middleware('web')->group(function () {
    Route::match(['get', 'post'], '/__test/setup-verified-room', function (Request $request) {
        abort_if(! app()->environment('local', 'testing'), 404);

        $user = User::factory()->create([
            'email' => test_helper_user_email(),
            'email_verified_at' => now(),
        ]);

        $room = new Room([
            'name' => 'Test Room',
            'invite_code' => Room::generateInviteCode(),
        ]);
        $room->user_id = $user->id;
        $room->save();

        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'last_seen_at' => now(),
        ]);

        if ($request->boolean('with_video')) {
            $room->update([
                'video_url' => 'https://www.example.com/video.mp4',
                'is_playing' => true,
                'position_seconds' => 0,
                'duration_seconds' => 120,
                'playback_rate' => 1,
                'state_version' => 1,
                'playback_mode' => 'direct',
            ]);
        }

        if ($request->boolean('local_video')) {
            // A same-origin video served by the dev server (public/videos/...).
            // Direct mode bypasses SSRF so the browser loads it directly — used by
            // the tap-to-play and playback-sync E2E to exercise real media
            // playback locally. Defaults to sample.mp4; pass ?video_file=name.ext
            // to select a different fixture (e.g. the long sync-sample.webm).
            $videoFile = $request->input('video_file', 'sample.mp4');
            $room->update([
                'video_url' => $request->getSchemeAndHttpHost().'/videos/'.$videoFile,
                'is_playing' => true,
                'position_seconds' => 0,
                'duration_seconds' => $videoFile === 'sample.mp4' ? 11 : 95,
                'playback_rate' => 1,
                'state_version' => 1,
                'playback_mode' => 'direct',
            ]);
        }

        if ($request->boolean('with_chat')) {
            foreach (['سلام!', 'این یک پیام تست است', 'How about this video?'] as $body) {
                ChatMessage::create([
                    'room_id' => $room->id,
                    'user_id' => $user->id,
                    'body' => $body,
                ]);
            }
        }

        if ($request->boolean('with_subtitle')) {
            $filename = sprintf('%d_test.vtt', time());
            $path = sprintf('subtitles/%d/%s', $room->id, $filename);
            $vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nزیرنویس فارسی\n\n2\n00:00:06.000 --> 00:00:10.000\nSecond cue in English";

            Storage::disk('local')->put($path, $vtt);

            SubtitleTrack::create([
                'room_id' => $room->id,
                'user_id' => $user->id,
                'label' => 'فارسی',
                'language' => 'fa',
                'file_path' => $path,
                'original_extension' => 'vtt',
            ]);
        }

        if ($request->boolean('with_guest')) {
            $guest = User::factory()->create([
                'email' => test_helper_user_email(),
                'email_verified_at' => now(),
            ]);
            RoomMember::create([
                'room_id' => $room->id,
                'user_id' => $guest->id,
                'last_seen_at' => now(),
            ]);
        }

        Auth::login($user);

        return response()->json([
            'user_id' => $user->id,
            'room_id' => $room->id,
            'invite_code' => $room->invite_code,
            'room_url' => route('rooms.show', $room),
        ]);
    });

    Route::post('/__test/join-room', function (Request $request) {
        abort_if(! app()->environment('local', 'testing'), 404);

        $request->validate(['invite_code' => 'required|string']);

        $room = Room::where('invite_code', $request->invite_code)->firstOrFail();

        $owner = User::find($room->user_id);

        $forceNew = $request->boolean('force_new');

        if (! $forceNew && $owner && $room->members()->where('user_id', $owner->id)->exists()) {
            Auth::login($owner);
            $user = $owner;
        } else {
            $user = User::factory()->create([
                'email' => test_helper_user_email(),
                'email_verified_at' => now(),
            ]);
            RoomMember::create([
                'room_id' => $room->id,
                'user_id' => $user->id,
                'last_seen_at' => now(),
            ]);
            Auth::login($user);
        }

        return response()->json([
            'user_id' => $user->id,
            'room_id' => $room->id,
        ]);
    });

    Route::get('/__test/verification-url', function (Request $request) {
        abort_if(! app()->environment('local', 'testing'), 404);

        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->firstOrFail();

        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())]
        );

        return response()->json(['url' => $url]);
    });
});
