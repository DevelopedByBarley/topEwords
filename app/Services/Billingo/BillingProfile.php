<?php

namespace App\Services\Billingo;

use App\Models\User;

final readonly class BillingProfile
{
    public function __construct(
        public int $userId,
        public string $name,
        public string $email,
        public ?string $billingName = null,
        public ?string $billingType = null,
        public ?string $billingCountry = null,
        public ?string $billingZip = null,
        public ?string $billingCity = null,
        public ?string $billingAddress = null,
        public ?string $billingPhone = null,
        public ?string $billingTaxNumber = null,
        public ?string $billingCompanyRegistrationNumber = null,
        public ?int $billingoPartnerId = null,
    ) {}

    public static function fromUser(User $user): self
    {
        return new self(
            userId: (int) $user->id,
            name: (string) $user->name,
            email: (string) $user->email,
            billingName: self::nullableString($user->billing_name),
            billingType: self::nullableString($user->billing_type),
            billingCountry: self::nullableString($user->billing_country),
            billingZip: self::nullableString($user->billing_zip),
            billingCity: self::nullableString($user->billing_city),
            billingAddress: self::nullableString($user->billing_address),
            billingPhone: self::nullableString($user->billing_phone),
            billingTaxNumber: self::nullableString($user->billing_tax_number),
            billingCompanyRegistrationNumber: self::nullableString($user->billing_company_registration_number),
            billingoPartnerId: $user->billingo_partner_id !== null ? (int) $user->billingo_partner_id : null,
        );
    }

    private static function nullableString(mixed $value): ?string
    {
        return $value === null ? null : (string) $value;
    }
}
