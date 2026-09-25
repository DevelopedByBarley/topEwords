<?php

namespace App\Services\Billingo;

use App\Models\User;

/**
 * A felhasználó számlázási adatainak pillanatképe a fizetés (dispatch) időpontjában.
 *
 * A számlázó job ezt szerializálja a User modell helyett: a NAV-számla kiállítási
 * kötelezettsége a fiók törlésével nem szűnik meg, a modell viszont a feldolgozásig
 * eltűnhet (a SerializesModels ilyenkor már a deszerializáláskor ModelNotFoundException-t
 * dobna, és a job failed() handlere sem futna le). A pillanatkép csak az InvoiceGenerator
 * által ténylegesen olvasott mezőket tartja — ugyanaz a gondolat, mint a Stripe invoice-ra
 * a GenerateBillingoInvoice::onlyNeededFields().
 */
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

    /**
     * A pillanatkép a felhasználó aktuális (adatbázisbeli) számlázási adataiból.
     */
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
