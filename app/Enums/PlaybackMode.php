<?php

declare(strict_types=1);

namespace App\Enums;

enum PlaybackMode: string
{
    case Direct = 'direct';
    case Proxy = 'proxy';
}
