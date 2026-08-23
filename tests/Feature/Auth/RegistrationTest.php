<?php

namespace Tests\Feature\Auth;

use App\Models\Room;
use App\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        // Registration dispatches the VerifyEmail notification synchronously;
        // faking it both guarantees no real mailer is touched (on top of
        // phpunit.xml's MAIL_MAILER=array) and lets us assert the send.
        Notification::fake();

        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
        Notification::assertSentTo(auth()->user(), VerifyEmail::class);
    }

    public function test_registration_preserves_intended_invite_url(): void
    {
        Notification::fake();

        $room = Room::factory()->create();

        $response = $this->withSession(['url.intended' => "/rooms/join/{$room->invite_code}"])
            ->post('/register', [
                'name' => 'Test User',
                'email' => 'test@example.com',
                'password' => 'password',
                'password_confirmation' => 'password',
            ]);

        $this->assertAuthenticated();
        $response->assertRedirect("/rooms/join/{$room->invite_code}");
        Notification::assertSentTo(auth()->user(), VerifyEmail::class);
    }
}
