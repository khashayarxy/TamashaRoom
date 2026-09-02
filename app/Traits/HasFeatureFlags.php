<?php

declare(strict_types=1);

namespace App\Traits;

trait HasFeatureFlags
{
    protected function featureEnabled(string $feature): bool
    {
        return (bool) config("features.{$feature}", false);
    }
}
