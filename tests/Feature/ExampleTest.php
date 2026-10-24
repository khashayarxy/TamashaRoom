<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_landing_metadata_exists_before_javascript_and_uses_the_configured_origin(): void
    {
        config(['app.url' => 'https://canonical.example']);
        $response = $this->get('/?campaign=test')->assertOk();
        $response->assertSee('<meta data-inertia="description" name="description"', false);
        $response->assertSee('<link data-inertia="canonical" rel="canonical" href="https://canonical.example/">', false);
        $response->assertSee('property="og:url" content="https://canonical.example/"', false);
        $this->get('/login')->assertOk()->assertDontSee('data-inertia="og:url"', false);
    }

    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Welcome')
            ->where('canonicalUrl', rtrim((string) config('app.url'), '/').'/')
        );
    }
}
