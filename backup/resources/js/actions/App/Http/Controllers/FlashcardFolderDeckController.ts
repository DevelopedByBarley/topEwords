import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardFolderDeckController::update
* @see app/Http/Controllers/FlashcardFolderDeckController.php:13
* @route '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}'
*/
export const update = (args: { flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } } | [flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FlashcardFolderDeckController::update
* @see app/Http/Controllers/FlashcardFolderDeckController.php:13
* @route '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}'
*/
update.url = (args: { flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } } | [flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            flashcardFolder: args[0],
            flashcardDeck: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        flashcardFolder: typeof args.flashcardFolder === 'object'
        ? args.flashcardFolder.id
        : args.flashcardFolder,
        flashcardDeck: typeof args.flashcardDeck === 'object'
        ? args.flashcardDeck.id
        : args.flashcardDeck,
    }

    return update.definition.url
            .replace('{flashcardFolder}', parsedArgs.flashcardFolder.toString())
            .replace('{flashcardDeck}', parsedArgs.flashcardDeck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardFolderDeckController::update
* @see app/Http/Controllers/FlashcardFolderDeckController.php:13
* @route '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}'
*/
update.patch = (args: { flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } } | [flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\FlashcardFolderDeckController::update
* @see app/Http/Controllers/FlashcardFolderDeckController.php:13
* @route '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}'
*/
const updateForm = (args: { flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } } | [flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardFolderDeckController::update
* @see app/Http/Controllers/FlashcardFolderDeckController.php:13
* @route '/flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}'
*/
updateForm.patch = (args: { flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } } | [flashcardFolder: number | { id: number }, flashcardDeck: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

const FlashcardFolderDeckController = { update }

export default FlashcardFolderDeckController