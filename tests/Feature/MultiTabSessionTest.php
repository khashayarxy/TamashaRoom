<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Middleware\SuppressAnonymousSessionCookie;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;
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

        $this->assertNull($sessionCookie, 'Even an expired cookie would invalidate the other tab.');
    }

    public function test_delayed_anonymous_response_cannot_replace_a_new_login_cookie(): void
    {
        $delayed = $this->getJson('/playback/9999/state')->assertUnauthorized();
        $user = User::factory()->create();
        $login = $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $login->assertRedirect();
        $name = (string) config('session.cookie');
        $jar = [];

        foreach ([$login, $delayed] as $response) {
            foreach ($response->headers->getCookies() as $cookie) {
                $jar[$cookie->getName()] = $cookie->getValue();
            }
        }

        $this->assertNotEmpty($jar[$name]);
        $this->assertSame($login->getCookie($name, false)->getValue(), $jar[$name]);
    }

    public function test_suppression_removes_all_session_paths_and_preserves_other_cookies(): void
    {
        $name = (string) config('session.cookie');
        $response = response()->json([]);
        $response->headers->setCookie(Cookie::create($name, 'guest', path: '/room', domain: 'example.com'));
        $response->headers->setCookie(Cookie::create($name, 'guest', path: '/'));
        $response->headers->setCookie(Cookie::create('XSRF-TOKEN', 'csrf'));

        $result = app(SuppressAnonymousSessionCookie::class)->handle(
            Request::create('/account/status', server: ['HTTP_ACCEPT' => 'application/json']), fn () => $response,
        );

        $this->assertSame(['XSRF-TOKEN'], array_map(fn ($cookie) => $cookie->getName(), $result->headers->getCookies()));
    }

    public function test_authenticated_json_response_keeps_its_session_cookie(): void
    {
        $this->actingAs(User::factory()->create());
        $name = (string) config('session.cookie');
        $response = response()->json([])->withCookie(cookie($name, 'authenticated'));
        $result = app(SuppressAnonymousSessionCookie::class)->handle(
            Request::create('/account/status'), fn () => $response,
        );

        $this->assertCount(1, $result->headers->getCookies());
        $this->assertSame('authenticated', $result->headers->getCookies()[0]->getValue());
    }

    public function test_authenticated_leave_response_cannot_overwrite_the_next_login(): void
    {
        $this->actingAs(User::factory()->create());
        $name = (string) config('session.cookie');
        $oldResponse = response()->json([])->withCookie(cookie($name, 'old-session'));
        $delayed = app(SuppressAnonymousSessionCookie::class)->handle(
            Request::create('/presence/1/leave', 'POST'), fn () => $oldResponse,
        );
        $browserSession = 'new-login-session';

        foreach ($delayed->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                $browserSession = $cookie->getValue();
            }
        }

        $this->assertSame('new-login-session', $browserSession);
    }

    public function test_anonymous_json_mutations_can_establish_or_invalidate_a_session(): void
    {
        $name = (string) config('session.cookie');
        $request = Request::create('/rooms/join/invite', 'POST', server: ['HTTP_ACCEPT' => 'application/json']);
        $response = response()->json([])->withCookie(cookie($name, 'guest-room-session'));
        $result = app(SuppressAnonymousSessionCookie::class)->handle($request, fn () => $response);
        $this->assertSame('guest-room-session', $result->headers->getCookies()[0]->getValue());
    }

    public function test_background_response_cannot_replace_the_new_login_csrf_cookie(): void
    {
        $this->actingAs(User::factory()->create());
        $response = response()->json([])
            ->withCookie(cookie((string) config('session.cookie'), 'old-session'))
            ->withCookie(cookie('XSRF-TOKEN', 'old-token'))
            ->withCookie(cookie('preference', 'keep'));
        $result = app(SuppressAnonymousSessionCookie::class)->handle(
            Request::create('/presence/1/leave', 'POST'), fn () => $response,
        );
        $this->assertSame(['preference'], array_map(fn ($cookie) => $cookie->getName(), $result->headers->getCookies()));
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
