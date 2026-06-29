import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\TextAnalysisController::practiceCheck
* @see app/Http/Controllers/TextAnalysisController.php:938
* @route '/words/practice/check'
*/
export const practiceCheck = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: practiceCheck.url(options),
    method: 'post',
})

practiceCheck.definition = {
    methods: ["post"],
    url: '/words/practice/check',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::practiceCheck
* @see app/Http/Controllers/TextAnalysisController.php:938
* @route '/words/practice/check'
*/
practiceCheck.url = (options?: RouteQueryOptions) => {
    return practiceCheck.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::practiceCheck
* @see app/Http/Controllers/TextAnalysisController.php:938
* @route '/words/practice/check'
*/
practiceCheck.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: practiceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::practiceCheck
* @see app/Http/Controllers/TextAnalysisController.php:938
* @route '/words/practice/check'
*/
const practiceCheckForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: practiceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::practiceCheck
* @see app/Http/Controllers/TextAnalysisController.php:938
* @route '/words/practice/check'
*/
practiceCheckForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: practiceCheck.url(options),
    method: 'post',
})

practiceCheck.form = practiceCheckForm

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:1006
* @route '/words/sentence-check'
*/
export const sentenceCheck = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: sentenceCheck.url(options),
    method: 'post',
})

sentenceCheck.definition = {
    methods: ["post"],
    url: '/words/sentence-check',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:1006
* @route '/words/sentence-check'
*/
sentenceCheck.url = (options?: RouteQueryOptions) => {
    return sentenceCheck.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:1006
* @route '/words/sentence-check'
*/
sentenceCheck.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: sentenceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:1006
* @route '/words/sentence-check'
*/
const sentenceCheckForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sentenceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:1006
* @route '/words/sentence-check'
*/
sentenceCheckForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sentenceCheck.url(options),
    method: 'post',
})

sentenceCheck.form = sentenceCheckForm

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
export const show = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/text-analysis',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.url = (options?: RouteQueryOptions) => {
    return show.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
const showForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
showForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
showForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

show.form = showForm

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
export const fetchSource = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fetchSource.url(options),
    method: 'post',
})

fetchSource.definition = {
    methods: ["post"],
    url: '/text-analysis/fetch-source',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSource.url = (options?: RouteQueryOptions) => {
    return fetchSource.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSource.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fetchSource.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
const fetchSourceForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fetchSource.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSourceForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fetchSource.url(options),
    method: 'post',
})

fetchSource.form = fetchSourceForm

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
export const listYoutube = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: listYoutube.url(options),
    method: 'get',
})

listYoutube.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
listYoutube.url = (options?: RouteQueryOptions) => {
    return listYoutube.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
listYoutube.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: listYoutube.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
listYoutube.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: listYoutube.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
const listYoutubeForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listYoutube.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
listYoutubeForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listYoutube.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1254
* @route '/text-analysis/youtube'
*/
listYoutubeForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listYoutube.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

listYoutube.form = listYoutubeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::storeYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1269
* @route '/text-analysis/youtube'
*/
export const storeYoutube = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeYoutube.url(options),
    method: 'post',
})

storeYoutube.definition = {
    methods: ["post"],
    url: '/text-analysis/youtube',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::storeYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1269
* @route '/text-analysis/youtube'
*/
storeYoutube.url = (options?: RouteQueryOptions) => {
    return storeYoutube.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::storeYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1269
* @route '/text-analysis/youtube'
*/
storeYoutube.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeYoutube.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::storeYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1269
* @route '/text-analysis/youtube'
*/
const storeYoutubeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeYoutube.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::storeYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1269
* @route '/text-analysis/youtube'
*/
storeYoutubeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeYoutube.url(options),
    method: 'post',
})

storeYoutube.form = storeYoutubeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
export const getYoutubePage = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getYoutubePage.url(args, options),
    method: 'get',
})

getYoutubePage.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube/{transcript}/page',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
getYoutubePage.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return getYoutubePage.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
getYoutubePage.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getYoutubePage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
getYoutubePage.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: getYoutubePage.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
const getYoutubePageForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getYoutubePage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
getYoutubePageForm.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getYoutubePage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getYoutubePage
* @see app/Http/Controllers/TextAnalysisController.php:1323
* @route '/text-analysis/youtube/{transcript}/page'
*/
getYoutubePageForm.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getYoutubePage.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

getYoutubePage.form = getYoutubePageForm

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
export const youtubeOverview = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: youtubeOverview.url(args, options),
    method: 'get',
})

youtubeOverview.definition = {
    methods: ["get","head"],
    url: '/text-analysis/youtube/{transcript}/overview',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
youtubeOverview.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return youtubeOverview.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
youtubeOverview.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: youtubeOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
youtubeOverview.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: youtubeOverview.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
const youtubeOverviewForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: youtubeOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
youtubeOverviewForm.get = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: youtubeOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::youtubeOverview
* @see app/Http/Controllers/TextAnalysisController.php:1338
* @route '/text-analysis/youtube/{transcript}/overview'
*/
youtubeOverviewForm.head = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: youtubeOverview.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

youtubeOverview.form = youtubeOverviewForm

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1351
* @route '/text-analysis/youtube/{transcript}'
*/
export const deleteYoutube = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteYoutube.url(args, options),
    method: 'delete',
})

deleteYoutube.definition = {
    methods: ["delete"],
    url: '/text-analysis/youtube/{transcript}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1351
* @route '/text-analysis/youtube/{transcript}'
*/
deleteYoutube.url = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { transcript: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { transcript: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            transcript: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        transcript: typeof args.transcript === 'object'
        ? args.transcript.id
        : args.transcript,
    }

    return deleteYoutube.definition.url
            .replace('{transcript}', parsedArgs.transcript.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1351
* @route '/text-analysis/youtube/{transcript}'
*/
deleteYoutube.delete = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteYoutube.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1351
* @route '/text-analysis/youtube/{transcript}'
*/
const deleteYoutubeForm = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteYoutube.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteYoutube
* @see app/Http/Controllers/TextAnalysisController.php:1351
* @route '/text-analysis/youtube/{transcript}'
*/
deleteYoutubeForm.delete = (args: { transcript: number | { id: number } } | [transcript: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteYoutube.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

deleteYoutube.form = deleteYoutubeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
export const analyze = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: analyze.url(options),
    method: 'post',
})

analyze.definition = {
    methods: ["post"],
    url: '/text-analysis/analyze',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyze.url = (options?: RouteQueryOptions) => {
    return analyze.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyze.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: analyze.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
const analyzeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: analyze.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyzeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: analyze.url(options),
    method: 'post',
})

analyze.form = analyzeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
export const wordLookup = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordLookup.url(options),
    method: 'get',
})

wordLookup.definition = {
    methods: ["get","head"],
    url: '/text-analysis/word-lookup',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.url = (options?: RouteQueryOptions) => {
    return wordLookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: wordLookup.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
const wordLookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookupForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookupForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

wordLookup.form = wordLookupForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
export const geminiWordLookup = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiWordLookup.url(options),
    method: 'get',
})

geminiWordLookup.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-lookup',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiWordLookup.url = (options?: RouteQueryOptions) => {
    return geminiWordLookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiWordLookup.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiWordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiWordLookup.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiWordLookup.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
const geminiWordLookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiWordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiWordLookupForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiWordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiWordLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiWordLookupForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiWordLookup.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiWordLookup.form = geminiWordLookupForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
export const geminiFlashcard = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiFlashcard.url(options),
    method: 'get',
})

geminiFlashcard.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-flashcard',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.url = (options?: RouteQueryOptions) => {
    return geminiFlashcard.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiFlashcard.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
const geminiFlashcardForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcardForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcardForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiFlashcard.form = geminiFlashcardForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
export const geminiListModels = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiListModels.url(options),
    method: 'get',
})

geminiListModels.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-models',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiListModels.url = (options?: RouteQueryOptions) => {
    return geminiListModels.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiListModels.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiListModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiListModels.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiListModels.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
const geminiListModelsForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiListModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiListModelsForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiListModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiListModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiListModelsForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiListModels.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiListModels.form = geminiListModelsForm

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
export const wordInsight = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordInsight.url(options),
    method: 'get',
})

wordInsight.definition = {
    methods: ["get","head"],
    url: '/text-analysis/word-insight',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.url = (options?: RouteQueryOptions) => {
    return wordInsight.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: wordInsight.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
const wordInsightForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsightForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsightForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

wordInsight.form = wordInsightForm

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
export const listBooks = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: listBooks.url(options),
    method: 'get',
})

listBooks.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
listBooks.url = (options?: RouteQueryOptions) => {
    return listBooks.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
listBooks.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: listBooks.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
listBooks.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: listBooks.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
const listBooksForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listBooks.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
listBooksForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listBooks.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::listBooks
* @see app/Http/Controllers/TextAnalysisController.php:581
* @route '/text-analysis/books'
*/
listBooksForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: listBooks.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

listBooks.form = listBooksForm

/**
* @see \App\Http\Controllers\TextAnalysisController::uploadBook
* @see app/Http/Controllers/TextAnalysisController.php:1359
* @route '/text-analysis/books'
*/
export const uploadBook = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: uploadBook.url(options),
    method: 'post',
})

uploadBook.definition = {
    methods: ["post"],
    url: '/text-analysis/books',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::uploadBook
* @see app/Http/Controllers/TextAnalysisController.php:1359
* @route '/text-analysis/books'
*/
uploadBook.url = (options?: RouteQueryOptions) => {
    return uploadBook.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::uploadBook
* @see app/Http/Controllers/TextAnalysisController.php:1359
* @route '/text-analysis/books'
*/
uploadBook.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: uploadBook.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::uploadBook
* @see app/Http/Controllers/TextAnalysisController.php:1359
* @route '/text-analysis/books'
*/
const uploadBookForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: uploadBook.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::uploadBook
* @see app/Http/Controllers/TextAnalysisController.php:1359
* @route '/text-analysis/books'
*/
uploadBookForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: uploadBook.url(options),
    method: 'post',
})

uploadBook.form = uploadBookForm

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
export const getBookPage = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getBookPage.url(args, options),
    method: 'get',
})

getBookPage.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books/{book}/page',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
getBookPage.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return getBookPage.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
getBookPage.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: getBookPage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
getBookPage.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: getBookPage.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
const getBookPageForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getBookPage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
getBookPageForm.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getBookPage.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::getBookPage
* @see app/Http/Controllers/TextAnalysisController.php:1442
* @route '/text-analysis/books/{book}/page'
*/
getBookPageForm.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: getBookPage.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

getBookPage.form = getBookPageForm

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
export const bookOverview = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: bookOverview.url(args, options),
    method: 'get',
})

bookOverview.definition = {
    methods: ["get","head"],
    url: '/text-analysis/books/{book}/overview',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
bookOverview.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return bookOverview.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
bookOverview.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: bookOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
bookOverview.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: bookOverview.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
const bookOverviewForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: bookOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
bookOverviewForm.get = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: bookOverview.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::bookOverview
* @see app/Http/Controllers/TextAnalysisController.php:1455
* @route '/text-analysis/books/{book}/overview'
*/
bookOverviewForm.head = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: bookOverview.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

bookOverview.form = bookOverviewForm

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteBook
* @see app/Http/Controllers/TextAnalysisController.php:1467
* @route '/text-analysis/books/{book}'
*/
export const deleteBook = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteBook.url(args, options),
    method: 'delete',
})

deleteBook.definition = {
    methods: ["delete"],
    url: '/text-analysis/books/{book}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteBook
* @see app/Http/Controllers/TextAnalysisController.php:1467
* @route '/text-analysis/books/{book}'
*/
deleteBook.url = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { book: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { book: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            book: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        book: typeof args.book === 'object'
        ? args.book.id
        : args.book,
    }

    return deleteBook.definition.url
            .replace('{book}', parsedArgs.book.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteBook
* @see app/Http/Controllers/TextAnalysisController.php:1467
* @route '/text-analysis/books/{book}'
*/
deleteBook.delete = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: deleteBook.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteBook
* @see app/Http/Controllers/TextAnalysisController.php:1467
* @route '/text-analysis/books/{book}'
*/
const deleteBookForm = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteBook.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::deleteBook
* @see app/Http/Controllers/TextAnalysisController.php:1467
* @route '/text-analysis/books/{book}'
*/
deleteBookForm.delete = (args: { book: number | { id: number } } | [book: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: deleteBook.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

deleteBook.form = deleteBookForm

const TextAnalysisController = { practiceCheck, sentenceCheck, show, fetchSource, listYoutube, storeYoutube, getYoutubePage, youtubeOverview, deleteYoutube, analyze, wordLookup, geminiWordLookup, geminiFlashcard, geminiListModels, wordInsight, listBooks, uploadBook, getBookPage, bookOverview, deleteBook }

export default TextAnalysisController