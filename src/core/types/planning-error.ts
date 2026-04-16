export type PlanningErrorKind =
    | 'multiple-selections'
    | 'unsupported-target'
    | 'unsupported-mode'

export interface PlanningError {
    kind: PlanningErrorKind
    message: string
}
