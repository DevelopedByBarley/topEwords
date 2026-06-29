<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <meta name="description" content="A 10 000 leggyakoribb angol szó egy helyen. Tanuld meg az angol szavakat rendszeresen – jelöld meg amit tudsz, amit tanulsz, és kövesd a haladásodat.">
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://topwords.eu{{ request()->getPathInfo() === '/' ? '' : request()->getPathInfo() }}">

        {{-- Open Graph --}}
        <meta property="og:type" content="website">
        <meta property="og:locale" content="hu_HU">
        <meta property="og:site_name" content="TopWords">
        <meta property="og:title" content="TopWords – Top 10 000 angol szó">
        <meta property="og:description" content="A 10 000 leggyakoribb angol szó egy helyen. Tanuld meg az angol szavakat rendszeresen – jelöld meg amit tudsz, amit tanulsz, és kövesd a haladásodat.">
        <meta property="og:url" content="https://topwords.eu{{ request()->getPathInfo() }}">
        <meta property="og:image" content="https://topwords.eu/og-image.png">

        {{-- Twitter Card --}}
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="TopWords – Top 10 000 angol szó">
        <meta name="twitter:description" content="A 10 000 leggyakoribb angol szó egy helyen. Tanuld meg az angol szavakat rendszeresen.">
        <meta name="twitter:image" content="https://topwords.eu/og-image.png">

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @if(request()->is('/'))
        @verbatim
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "TopWords",
            "url": "https://topwords.eu",
            "description": "A 10 000 leggyakoribb angol szó egy helyen. Tanuld meg az angol szavakat rendszeresen.",
            "applicationCategory": "EducationApplication",
            "operatingSystem": "Web",
            "inLanguage": "hu",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "HUF" },
            "author": { "@type": "Organization", "name": "CodeBarley", "url": "https://codebarley.hu" }
        }
        </script>
        @endverbatim
        @endif

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
