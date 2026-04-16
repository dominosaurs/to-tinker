export type PlanningErrorKind =
    | 'incomplete-boundary'
    | 'multiple-selections'
    | 'no-callable-at-position'
    | 'unsupported-target'
    | 'unsupported-mode'

export interface PlanningError {
    kind: PlanningErrorKind
    message: string
}
