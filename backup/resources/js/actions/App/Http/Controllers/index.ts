import StripeWebhookController from './StripeWebhookController'
import PricingController from './PricingController'
import AdminController from './AdminController'
import OnboardingController from './OnboardingController'
import DashboardController from './DashboardController'
import AchievementController from './AchievementController'
import WordController from './WordController'
import TextAnalysisController from './TextAnalysisController'
import ClozeController from './ClozeController'
import QuizController from './QuizController'
import ReviewController from './ReviewController'
import IrregularVerbController from './IrregularVerbController'
import UserCustomWordController from './UserCustomWordController'
import FolderController from './FolderController'
import FolderWordController from './FolderWordController'
import FlashcardDeckController from './FlashcardDeckController'
import FlashcardCardController from './FlashcardCardController'
import FlashcardCsvController from './FlashcardCsvController'
import FlashcardCalibrationController from './FlashcardCalibrationController'
import FlashcardStudyController from './FlashcardStudyController'
import FlashcardFolderController from './FlashcardFolderController'
import FlashcardFolderDeckController from './FlashcardFolderDeckController'
import ExtensionController from './ExtensionController'
import Settings from './Settings'

const Controllers = {
    StripeWebhookController: Object.assign(StripeWebhookController, StripeWebhookController),
    PricingController: Object.assign(PricingController, PricingController),
    AdminController: Object.assign(AdminController, AdminController),
    OnboardingController: Object.assign(OnboardingController, OnboardingController),
    DashboardController: Object.assign(DashboardController, DashboardController),
    AchievementController: Object.assign(AchievementController, AchievementController),
    WordController: Object.assign(WordController, WordController),
    TextAnalysisController: Object.assign(TextAnalysisController, TextAnalysisController),
    ClozeController: Object.assign(ClozeController, ClozeController),
    QuizController: Object.assign(QuizController, QuizController),
    ReviewController: Object.assign(ReviewController, ReviewController),
    IrregularVerbController: Object.assign(IrregularVerbController, IrregularVerbController),
    UserCustomWordController: Object.assign(UserCustomWordController, UserCustomWordController),
    FolderController: Object.assign(FolderController, FolderController),
    FolderWordController: Object.assign(FolderWordController, FolderWordController),
    FlashcardDeckController: Object.assign(FlashcardDeckController, FlashcardDeckController),
    FlashcardCardController: Object.assign(FlashcardCardController, FlashcardCardController),
    FlashcardCsvController: Object.assign(FlashcardCsvController, FlashcardCsvController),
    FlashcardCalibrationController: Object.assign(FlashcardCalibrationController, FlashcardCalibrationController),
    FlashcardStudyController: Object.assign(FlashcardStudyController, FlashcardStudyController),
    FlashcardFolderController: Object.assign(FlashcardFolderController, FlashcardFolderController),
    FlashcardFolderDeckController: Object.assign(FlashcardFolderDeckController, FlashcardFolderDeckController),
    ExtensionController: Object.assign(ExtensionController, ExtensionController),
    Settings: Object.assign(Settings, Settings),
}

export default Controllers