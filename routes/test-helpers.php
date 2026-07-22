<?php

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\SubtitleTrack;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::middleware('web')->group(function () {
    Route::post('/__test/setup-verified-room', function (Request $request) {
        abort_if(! app()->environment('local', 'testing'), 404);

        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $room = Room::create([
            'name' => 'Test Room',
            'user_id' => $user->id,
            'invite_code' => Room::generateInviteCode(),
        ]);

        $room->members()->attach($user->id, ['role' => 'host']);

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

            Storage::disk('public')->put($path, $vtt);

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
                'email_verified_at' => now(),
            ]);
            $room->members()->attach($guest->id, ['role' => 'member']);
            $room->increment('current_users');
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

        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $room->members()->attach($user->id, ['role' => 'member']);
        $room->increment('current_users');

        Auth::login($user);

        return response()->json([
            'user_id' => $user->id,
            'room_id' => $room->id,
        ]);
    });
});
