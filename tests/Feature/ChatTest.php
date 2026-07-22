<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

        $response->assertForbidden();
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

        $response->assertForbidden();
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
    public function user_cannot_delete_others_message(): void
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

        $response->assertForbidden();
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
}
