<?php

declare(strict_types=1);

namespace Tests\Feature;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class ProductionJsonErrorsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);
    }

    public function test_validation_keeps_field_errors_and_422_with_debug_disabled(): void
    {
        Route::post('/_exception-validation', fn (Request $request) => $request->validate(['name' => 'required|string']));

        $this->postJson('/_exception-validation', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_authentication_keeps_401_with_debug_disabled(): void
    {
        Log::spy();

        Route::get('/_exception-auth', function (): never {
            throw new AuthenticationException;
        })->name('playback.exception-test');

        $this->getJson('/_exception-auth')->assertUnauthorized();

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => $context['http_status'] === 401,
        );
        Log::shouldNotHaveReceived('error');
    }

    public function test_authorization_keeps_403_with_debug_disabled(): void
    {
        Route::get('/_exception-forbidden', function (): never {
            throw new AuthorizationException;
        });

        $this->getJson('/_exception-forbidden')->assertForbidden();
    }

    public function test_unexpected_errors_stay_sanitized_with_debug_disabled(): void
    {
        Route::get('/_exception-unexpected', function (): never {
            throw new RuntimeException('private exception detail');
        });

        $this->getJson('/_exception-unexpected')
            ->assertInternalServerError()
            ->assertExactJson(['message' => 'Server Error']);
    }

    public function test_explicit_http_response_keeps_body_headers_and_status_with_debug_disabled(): void
    {
        Log::spy();

        $middleware = new class
        {
            public function handle(Request $request, Closure $next): never
            {
                abort(response()->json(['message' => 'State conflict'], 409, ['X-Conflict' => 'version']));
            }
        };

        $this->app->instance('production-conflict-response', $middleware);

        Route::get('/_exception-response', fn () => response()->noContent())
            ->middleware('production-conflict-response')
            ->name('playback.exception-response-test');

        $this->getJson('/_exception-response')
            ->assertStatus(409)
            ->assertExactJson(['message' => 'State conflict'])
            ->assertHeader('X-Conflict', 'version');

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => $context['http_status'] === 409,
        );
        Log::shouldNotHaveReceived('error');
    }
}
