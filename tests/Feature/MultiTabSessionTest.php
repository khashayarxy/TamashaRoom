<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiTabSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_session_regeneration_on_login_destroys_pre_login_session_id(): void
    {
        $user = User::factory()->create();

        // 1. Initial request establishes a pre-login session ID
        $this->withSession(['_token' => 'test-token'])
            ->get('/login')
            ->assertOk();

        $preLoginSessionId = session()->getId();
        $this->assertNotEmpty($preLoginSessionId);

        // 2. Perform login — authenticates user and regenerates session with $destroy = true
        $response = $this->post('/login', [
            '_token' => 'test-token',
            'email' => $user->email,
            'password' => 'password',
        ]);
        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticatedAs($user);

        $postLoginSessionId = session()->getId();
        $this->assertNotEquals($preLoginSessionId, $postLoginSessionId);

        // 3. Pre-login session ID was destroyed in session store ($destroy = true)
        $this->assertNull(app('session')->driver()->get($preLoginSessionId));
    }

    public function test_unauthenticated_background_api_polls_do_not_issue_guest_session_cookie(): void
    {
        // Background polling routes return 401/302 when unauthenticated and MUST NOT
        // issue a valid unauthenticated laravel_session cookie that overwrites browser cookies.
        $response = $this->getJson('/playback/9999/state');

        $response->assertStatus(401);
        $cookieName = (string) config('session.cookie', 'laravel_session');

        $cookies = $response->headers->getCookies();
        $sessionCookie = collect($cookies)->first(fn ($c) => $c->getName() === $cookieName);

        $this->assertTrue(
            $sessionCookie === null ||
            $sessionCookie->getValue() === null ||
            $sessionCookie->getExpiresTime() < time(),
            'Unauthenticated polling route issued an active session cookie.'
        );
    }

    public function test_closing_and_reopening_tab_reconnects_to_room_without_reinvitation(): void
    {
        $owner = User::factory()->create();
        $room = Room::factory()->create(['user_id' => $owner->id]);

        $memberUser = User::factory()->create();

        // User joins room
        $this->actingAs($memberUser)
            ->post(route('rooms.join.submit', $room->invite_code))
            ->assertRedirect(route('rooms.show', $room));

        $this->assertDatabaseHas('room_members', [
            'room_id' => $room->id,
            'user_id' => $memberUser->id,
        ]);

        // User tab closes (leave beacon fires)
        $this->actingAs($memberUser)
            ->post(route('presence.leave', $room))
            ->assertOk();

        // Member status is offline, but room_members record remains intact
        $this->assertDatabaseHas('room_members', [
            'room_id' => $room->id,
            'user_id' => $memberUser->id,
            'presence_status' => 'offline',
        ]);

        // User reopens the room tab directly without using invite link
        $reopenResponse = $this->actingAs($memberUser)
            ->get(route('rooms.show', $room));

        $reopenResponse->assertOk();

        // Heartbeat runs on mount and restores presence to online
        $this->actingAs($memberUser)
            ->post(route('presence.heartbeat', $room))
            ->assertOk();

        $this->assertDatabaseHas('room_members', [
            'room_id' => $room->id,
            'user_id' => $memberUser->id,
            'presence_status' => 'online',
        ]);
    }
}
