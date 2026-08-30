<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\MessageReport;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Broadcasting\BroadcastEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ChatTest extends TestCase
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
    public function owner_can_send_message(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson(route('chat.store', $this->room), [
                'body' => 'Hello from owner',
            ]);

        $response->assertCreated()
            ->assertJson([
                'body' => 'Hello from owner',
                'user_id' => $this->owner->id,
            ]);
    }

    #[Test]
    public function member_can_send_message(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson(route('chat.store', $this->room), [
                'body' => 'Hello from member',
            ]);

        $response->assertCreated()
            ->assertJson([
                'body' => 'Hello from member',
                'user_id' => $this->member->id,
            ]);
    }

    #[Test]
    public function stranger_cannot_send_message(): void
    {
        $response = $this->actingAs($this->stranger)
            ->postJson(route('chat.store', $this->room), [
                'body' => 'Hello from stranger',
            ]);

        $response->assertNotFound();
    }

    #[Test]
    public function unauthenticated_user_cannot_send_message(): void
    {
        $response = $this->postJson(route('chat.store', $this->room), [
            'body' => 'Hello',
        ]);

        $response->assertUnauthorized();
    }

    #[Test]
    public function owner_can_list_messages(): void
    {
        ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'First message',
        ]);

        $response = $this->actingAs($this->owner)
            ->getJson(route('chat.index', $this->room));

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJson([['body' => 'First message']]);
    }

    #[Test]
    public function stranger_cannot_list_messages(): void
    {
        $response = $this->actingAs($this->stranger)
            ->getJson(route('chat.index', $this->room));

        $response->assertNotFound();
    }

    #[Test]
    public function user_can_delete_own_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'To be deleted',
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson(route('chat.destroy', ['room' => $this->room, 'message' => $message]));

        $response->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->assertDatabaseMissing('chat_messages', ['id' => $message->id]);
    }

    #[Test]
    public function owner_can_delete_members_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'body' => 'Member message',
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson(route('chat.destroy', ['room' => $this->room, 'message' => $message]));

        $response->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->assertDatabaseMissing('chat_messages', ['id' => $message->id]);
    }

    #[Test]
    public function member_cannot_delete_other_members_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Owner message',
        ]);

        $response = $this->actingAs($this->member)
            ->deleteJson(route('chat.destroy', ['room' => $this->room, 'message' => $message]));

        $response->assertForbidden();
    }

    #[Test]
    public function stranger_cannot_delete_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Owner message',
        ]);

        $response = $this->actingAs($this->stranger)
            ->deleteJson(route('chat.destroy', ['room' => $this->room, 'message' => $message]));

        $response->assertNotFound();
    }

    #[Test]
    public function body_is_required_and_max_500_chars(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson(route('chat.store', $this->room), []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['body']);

        $longBody = str_repeat('a', 501);
        $response = $this->actingAs($this->owner)
            ->postJson(route('chat.store', $this->room), ['body' => $longBody]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['body']);
    }

    #[Test]
    public function cannot_delete_a_message_from_another_room(): void
    {
        $otherRoom = Room::factory()->create(['user_id' => $this->owner->id]);
        $otherMessage = ChatMessage::create([
            'room_id' => $otherRoom->id,
            'user_id' => $this->owner->id,
            'body' => 'Other room message',
        ]);

        $response = $this->actingAs($this->owner)
            ->deleteJson(route('chat.destroy', [
                'room' => $this->room,
                'message' => $otherMessage,
            ]));

        $response->assertNotFound();

        $this->assertDatabaseHas('chat_messages', ['id' => $otherMessage->id]);
    }

    /**
     * Production drains its database queue once a minute via cron, so a queued
     * chat broadcast would arrive well after the 3s poll already delivered the
     * message. Chat events must broadcast synchronously.
     */
    #[Test]
    public function chat_broadcast_is_not_queued_on_the_database_queue(): void
    {
        config(['queue.default' => 'database']);
        Queue::fake();

        $this->actingAs($this->owner)
            ->postJson(route('chat.store', $this->room), [
                'body' => 'sync broadcast',
            ])
            ->assertCreated();

        Queue::assertNotPushed(BroadcastEvent::class);
    }

    #[Test]
    public function member_can_report_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Reported message',
        ]);

        $response = $this->actingAs($this->member)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]), [
                'reason' => 'spam',
                'details' => 'This is spam',
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'ok',
                'message' => 'گزارش پیام ثبت شد.',
            ]);

        $this->assertDatabaseHas('message_reports', [
            'message_id' => $message->id,
            'reporter_id' => $this->member->id,
            'reason' => 'spam',
        ]);
    }

    #[Test]
    public function owner_can_report_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'body' => 'Reported by owner',
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]));

        $response->assertOk()
            ->assertJson(['status' => 'ok']);
    }

    #[Test]
    public function duplicate_report_is_rejected(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Already reported',
        ]);

        MessageReport::create([
            'room_id' => $this->room->id,
            'message_id' => $message->id,
            'reporter_id' => $this->member->id,
        ]);

        $response = $this->actingAs($this->member)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]));

        $response->assertUnprocessable()
            ->assertJson([
                'status' => 'error',
                'message' => 'این پیام قبلاً توسط شما گزارش شده است.',
            ]);
    }

    #[Test]
    public function cannot_report_message_from_another_room(): void
    {
        $otherRoom = Room::factory()->create(['user_id' => $this->owner->id]);
        $otherMessage = ChatMessage::create([
            'room_id' => $otherRoom->id,
            'user_id' => $this->owner->id,
            'body' => 'Other room message',
        ]);

        $response = $this->actingAs($this->member)
            ->postJson(route('chat.report', [
                'room' => $this->room,
                'message' => $otherMessage,
            ]));

        $response->assertNotFound();

        $this->assertDatabaseMissing('message_reports', [
            'message_id' => $otherMessage->id,
        ]);
    }

    #[Test]
    public function stranger_cannot_report_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Owner message',
        ]);

        $response = $this->actingAs($this->stranger)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]));

        $response->assertNotFound();
    }

    #[Test]
    public function unauthenticated_user_cannot_report_message(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Owner message',
        ]);

        $response = $this->postJson(route('chat.report', [
            'room' => $this->room,
            'message' => $message,
        ]));

        $response->assertUnauthorized();
    }

    #[Test]
    public function report_validates_reason_and_details_length(): void
    {
        $message = ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Valid message',
        ]);

        $longReason = str_repeat('a', 101);
        $response = $this->actingAs($this->member)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]), [
                'reason' => $longReason,
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        $longDetails = str_repeat('a', 1001);
        $response = $this->actingAs($this->member)
            ->postJson(route('chat.report', ['room' => $this->room, 'message' => $message]), [
                'details' => $longDetails,
            ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['details']);
    }
}
