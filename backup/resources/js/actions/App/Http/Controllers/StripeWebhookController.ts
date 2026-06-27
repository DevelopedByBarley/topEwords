import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\StripeWebhookController::handleWebhook
* @see app/Http/Controllers/StripeWebhookController.php:40
* @route '/stripe/webhook'
*/
export const handleWebhook = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: handleWebhook.url(options),
    method: 'post',
})

handleWebhook.definition = {
    methods: ["post"],
    url: '/stripe/webhook',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\StripeWebhookController::handleWebhook
* @see app/Http/Controllers/StripeWebhookController.php:40
* @route '/stripe/webhook'
*/
handleWebhook.url = (options?: RouteQueryOptions) => {
    return handleWebhook.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\StripeWebhookController::handleWebhook
* @see app/Http/Controllers/StripeWebhookController.php:40
* @route '/stripe/webhook'
*/
handleWebhook.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: handleWebhook.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\StripeWebhookController::handleWebhook
* @see app/Http/Controllers/StripeWebhookController.php:40
* @route '/stripe/webhook'
*/
const handleWebhookForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: handleWebhook.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\StripeWebhookController::handleWebhook
* @see app/Http/Controllers/StripeWebhookController.php:40
* @route '/stripe/webhook'
*/
handleWebhookForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: handleWebhook.url(options),
    method: 'post',
})

handleWebhook.form = handleWebhookForm

const StripeWebhookController = { handleWebhook }

export default StripeWebhookController