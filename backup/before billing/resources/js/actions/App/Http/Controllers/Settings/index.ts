import ProfileController from './ProfileController'
import BillingController from './BillingController'
import SecurityController from './SecurityController'
import FlashcardController from './FlashcardController'
import SubscriptionController from './SubscriptionController'

const Settings = {
    ProfileController: Object.assign(ProfileController, ProfileController),
    BillingController: Object.assign(BillingController, BillingController),
    SecurityController: Object.assign(SecurityController, SecurityController),
    FlashcardController: Object.assign(FlashcardController, FlashcardController),
    SubscriptionController: Object.assign(SubscriptionController, SubscriptionController),
}

export default Settings