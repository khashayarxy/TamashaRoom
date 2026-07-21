<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use App\Services\PresenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PresenceServiceTest extends TestCase
{
    use RefreshDatabase;

    private PresenceService $presence;

    private User $user;

    private Room $room;

    private RoomMember $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->presence = new PresenceService;
        $this->user = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->user->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);

        $this->member = RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->user->id,
            'last_seen_at' => now()->subMinutes(5),
            'presence_status' => 'online',
            'heartbeat_version' => 5,
            'joined_at' => now()->subDays(1),
        ]);
    }

    #[Test]
    public function heartbeat_updates_last_seen_and_increments_version(): void
    {
        $result = $this->presence->heartbeat($this->room, $this->user);

        $this->assertEquals('online', $result->presence_status);
        $this->assertEquals(6, $result->heartbeat_version);
        $this->assertGreaterThan($this->member->last_seen_at->timestamp, $result->last_seen_at->timestamp);
    }

    #[Test]
    public function heartbeat_restores_offline_member(): void
    {
        $this->member->update([
            'presence_status' => 'offline',
            'disconnected_at' => now()->subHour(),
        ]);

        $result = $this->presence->heartbeat($this->room, $this->user);

        $this->assertEquals('online', $result->presence_status);
        $this->assertEquals(6, $result->heartbeat_version);
    }

    #[Test]
    public function leave_marks_member_offline(): void
    {
        $this->presence->leave($this->room, $this->user);

        $this->member->refresh();
        $this->assertEquals('offline', $this->member->presence_status);
        $this->assertNotNull($this->member->disconnected_at);
    }

    #[Test]
    public function get_presence_returns_all_members_with_status(): void
    {
        $result = $this->presence->getPresence($this->room);

        $this->assertCount(1, $result);
        $this->assertEquals($this->user->id, $result[0]['user_id']);
        $this->assertEquals('online', $result[0]['presence_status']);
        $this->assertTrue($result[0]['is_owner']);
    }

    #[Test]
    public function mark_stale_detects_expired_heartbeats(): void
    {
        RoomMember::where('id', $this->member->id)
            ->update(['last_seen_at' => now()->subMinutes(5)]);

        $count = $this->presence->markStaleAsOffline();

        $this->assertEquals(1, $count);

        $this->member->refresh();
        $this->assertEquals('offline', $this->member->presence_status);
        $this->assertNotNull($this->member->disconnected_at);
    }

    #[Test]
    public function mark_stale_skips_recent_heartbeats(): void
    {
        RoomMember::where('id', $this->member->id)
            ->update(['last_seen_at' => now()->subMinute()]);

        $count = $this->presence->markStaleAsOffline();

        $this->assertEquals(0, $count);

        $this->member->refresh();
        $this->assertEquals('online', $this->member->presence_status);
    }

    #[Test]
    public function mark_stale_does_not_affect_offline_members(): void
    {
        RoomMember::where('id', $this->member->id)->update([
            'presence_status' => 'offline',
            'last_seen_at' => now()->subDays(1),
        ]);

        $count = $this->presence->markStaleAsOffline();

        $this->assertEquals(0, $count);
    }

    #[Test]
    public function presence_includes_joined_timestamp(): void
    {
        $result = $this->presence->getPresence($this->room);

        $this->assertNotNull($result[0]['joined_at']);
    }
}
