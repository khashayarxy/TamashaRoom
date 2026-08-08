<?php

namespace Tests\Feature\Auth;

use App\Models\Room;
use App\Models\User;
use App\Notifications\VerifyEmail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_verification_screen_can_be_rendered(): void
    {
        $user = User::factory()->unverified()->create();

        $response = $this->actingAs($user)->get('/verify-email');

        $response->assertStatus(200);
    }

    public function test_email_can_be_verified(): void
    {
        $user = User::factory()->unverified()->create();

        Event::fake();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        $response = $this->actingAs($user)->get($verificationUrl);

        Event::assertDispatched(Verified::class);
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $response->assertRedirect(route('dashboard', absolute: false).'?verified=1');
    }

    public function test_email_is_not_verified_with_invalid_hash(): void
    {
        $user = User::factory()->unverified()->create();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1('wrong-email')]
        );

        $this->actingAs($user)->get($verificationUrl);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_unverified_registered_user_is_redirected_to_verification_prompt(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('verification.notice'));
    }

    public function test_verified_user_can_access_gated_routes(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/dashboard')->assertOk();
    }

    public function test_guest_user_is_exempt_from_email_verification(): void
    {
        $guest = User::factory()->unverified()->create(['is_guest' => true]);

        $this->actingAs($guest)->get('/dashboard')->assertOk();
    }

    public function test_guest_join_flow_never_shows_a_verification_prompt(): void
    {
        $owner = User::factory()->create();

        $room = Room::factory()->create([
            'user_id' => $owner->id,
            'invite_code' => 'GUESTV',
            'max_members' => 10,
        ]);

        $response = $this->from("/rooms/join/{$room->invite_code}")
            ->post("/rooms/join/{$room->invite_code}", [
                'guest_name' => 'مهمان تست',
            ]);

        $response->assertRedirect(route('rooms.show', $room));

        $guest = User::where('is_guest', true)->firstOrFail();

        $this->assertTrue($guest->hasVerifiedEmail());

        $this->actingAs($guest)->get(route('rooms.show', $room))->assertOk();
    }

    public function test_registration_sends_persian_verification_email(): void
    {
        Notification::fake();

        $this->post('/register', [
            'name' => 'آرش تستی',
            'email' => 'test-user@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $user = User::where('email', 'test-user@example.com')->firstOrFail();

        Notification::assertSentTo(
            $user,
            VerifyEmail::class,
            fn (VerifyEmail $notification) => str_contains($notification->toMail($user)->subject, 'تایید ایمیل')
        );
    }

    public function test_guest_user_is_not_sent_a_verification_email(): void
    {
        Notification::fake();

        $owner = User::factory()->create();

        $room = Room::factory()->create([
            'user_id' => $owner->id,
            'invite_code' => 'GUEST02',
            'max_members' => 10,
        ]);

        $this->post("/rooms/join/{$room->invite_code}", [
            'guest_name' => 'مهمان',
        ]);

        $guest = User::where('is_guest', true)->firstOrFail();

        Notification::assertNotSentTo($guest, VerifyEmail::class);
    }
}
