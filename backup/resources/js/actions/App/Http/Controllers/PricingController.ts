import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/pricing',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::index
* @see app/Http/Controllers/PricingController.php:15
* @route '/pricing'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
export const success = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: success.url(options),
    method: 'get',
})

success.definition = {
    methods: ["get","head"],
    url: '/pricing/success',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
success.url = (options?: RouteQueryOptions) => {
    return success.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
success.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: success.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
success.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: success.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
const successForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: success.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
successForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: success.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\PricingController::success
* @see app/Http/Controllers/PricingController.php:112
* @route '/pricing/success'
*/
successForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: success.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

success.form = successForm

/**
* @see \App\Http\Controllers\PricingController::checkout
* @see app/Http/Controllers/PricingController.php:39
* @route '/pricing/checkout/{plan}'
*/
export const checkout = (args: { plan: string | number } | [plan: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: checkout.url(args, options),
    method: 'post',
})

checkout.definition = {
    methods: ["post"],
    url: '/pricing/checkout/{plan}',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\PricingController::checkout
* @see app/Http/Controllers/PricingController.php:39
* @route '/pricing/checkout/{plan}'
*/
checkout.url = (args: { plan: string | number } | [plan: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { plan: args }
    }

    if (Array.isArray(args)) {
        args = {
            plan: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        plan: args.plan,
    }

    return checkout.definition.url
            .replace('{plan}', parsedArgs.plan.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\PricingController::checkout
* @see app/Http/Controllers/PricingController.php:39
* @route '/pricing/checkout/{plan}'
*/
checkout.post = (args: { plan: string | number } | [plan: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: checkout.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\PricingController::checkout
* @see app/Http/Controllers/PricingController.php:39
* @route '/pricing/checkout/{plan}'
*/
const checkoutForm = (args: { plan: string | number } | [plan: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: checkout.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\PricingController::checkout
* @see app/Http/Controllers/PricingController.php:39
* @route '/pricing/checkout/{plan}'
*/
checkoutForm.post = (args: { plan: string | number } | [plan: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: checkout.url(args, options),
    method: 'post',
})

checkout.form = checkoutForm

/**
* @see \App\Http\Controllers\PricingController::portal
* @see app/Http/Controllers/PricingController.php:124
* @route '/pricing/portal'
*/
export const portal = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: portal.url(options),
    method: 'post',
})

portal.definition = {
    methods: ["post"],
    url: '/pricing/portal',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\PricingController::portal
* @see app/Http/Controllers/PricingController.php:124
* @route '/pricing/portal'
*/
portal.url = (options?: RouteQueryOptions) => {
    return portal.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\PricingController::portal
* @see app/Http/Controllers/PricingController.php:124
* @route '/pricing/portal'
*/
portal.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: portal.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\PricingController::portal
* @see app/Http/Controllers/PricingController.php:124
* @route '/pricing/portal'
*/
const portalForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: portal.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\PricingController::portal
* @see app/Http/Controllers/PricingController.php:124
* @route '/pricing/portal'
*/
portalForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: portal.url(options),
    method: 'post',
})

portal.form = portalForm

const PricingController = { index, success, checkout, portal }

export default PricingCon