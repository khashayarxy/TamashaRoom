<?php

declare(strict_types=1);

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

trait Auditable
{
    protected function audit(
        string $action,
        ?Model $auditable = null,
        ?array $context = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'auditable_type' => $auditable ? $auditable::class : null,
            'auditable_id' => $auditable?->getKey(),
            'context' => array_merge([
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ], $context ?? []),
        ]);
    }
}
