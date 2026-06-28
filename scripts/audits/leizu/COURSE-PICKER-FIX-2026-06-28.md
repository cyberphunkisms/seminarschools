# Leizu course picker repair

The course catalogue now uses one delegated interaction layer that survives all catalogue re-renders. A course card, a subject-wide Select all button, and each Path button remain keyboard accessible, show their selected state, and persist their state in local storage.

A selected course carries its course ID and any ESL support request into the Leizu intake. A selected path carries its path code into the same form, appears in the visible selection summary, and is submitted as `selected-path` with the intake.

Turning on Simple English marks every course card for ESL support. The intake only receives ESL support for subjects the visitor actually selected.
