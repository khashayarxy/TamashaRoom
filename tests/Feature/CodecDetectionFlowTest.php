<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CodecDetectionFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_hevc_video_with_persian_message(): void
    {
        $user = User::factory()->create();
        $room = Room::factory()->create(['user_id' => $user->id]);

        $fakeHevcMp4 = "\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isomhev1".str_repeat('0', 1000);

        Http::fake([
            'example.com/*' => Http::response($fakeHevcMp4, 206, [
                'Content-Range' => 'bytes 0-1031/1032',
                'Content-Type' => 'video/mp4',
            ]),
        ]);

        $response = $this->actingAs($user)->postJson("/playback/{$room->id}/set-video", [
            'video_url' => 'https://example.com/video.mp4',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'status' => 'error',
            'message' => 'این ویدیو با کدک HEVC/x265 فشرده‌سازی شده که فعلاً پشتیبانی نمی‌شود. لطفاً از فایل‌های MP4 یا MKV با کدک H.264 استفاده کنید.',
        ]);
    }

    public function test_allows_h264_video_to_be_set(): void
    {
        $user = User::factory()->create();
        $room = Room::factory()->create(['user_id' => $user->id]);

        $fakeH264Mp4 = "\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2avc1mp41".str_repeat('0', 1000);

        Http::fake([
            'example.com/*' => Http::response($fakeH264Mp4, 206, [
                'Content-Range' => 'bytes 0-1031/1032',
                'Content-Type' => 'video/mp4',
            ]),
        ]);

        $response = $this->actingAs($user)->postJson("/playback/{$room->id}/set-video", [
            'video_url' => 'https://example.com/video.mp4',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'ok',
        ]);
    }
}
