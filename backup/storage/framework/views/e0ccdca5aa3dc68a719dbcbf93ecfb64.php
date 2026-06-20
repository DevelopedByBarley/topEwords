# PHP

<?php
/** @var \Laravel\Boost\Install\GuidelineAssist $assist */
?>
<?php if($assist->shouldEnforceStrictTypes()): ?>
- Always declare ___SINGLE_BACKTICK___declare(strict_types=1);___SINGLE_BACKTICK___ at the top of every ___SINGLE_BACKTICK___.php___SINGLE_BACKTICK___ file.
<?php endif; ?>
- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: ___SINGLE_BACKTICK___public function __construct(public GitHub $github) { }___SINGLE_BACKTICK___. Do not leave empty zero-parameter ___SINGLE_BACKTICK_____construct()___SINGLE_BACKTICK___ methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: ___SINGLE_BACKTICK___function isAccessible(User $user, ?string $path = null): bool___SINGLE_BACKTICK___
<?php if(empty($assist->enums()) || preg_match('/[A-Z]{3,8}/', $assist->enumContents())): ?>
- Use TitleCase for Enum keys: ___SINGLE_BACKTICK___FavoritePerson___SINGLE_BACKTICK___, ___SINGLE_BACKTICK___BestLake___SINGLE_BACKTICK___, ___SINGLE_BACKTICK___Monthly___SINGLE_BACKTICK___.
<?php else: ?>
- Follow existing application Enum naming conventions.
<?php endif; ?>
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.
<?php /**PATH /Applications/XAMPP/xamppfiles/htdocs/topEwords/storage/framework/views/7d009683586f6621c6aa2d9ed048042d.blade.php ENDPATH**/ ?>