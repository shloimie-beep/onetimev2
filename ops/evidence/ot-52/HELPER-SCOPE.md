# OT-52P Helper Scope

## Default Behavior

- Parent and student helper availability returns unavailable.
- Helper query requires `helper:query`.
- Even with `helper:query`, default helper query returns `ADAPTER_UNAVAILABLE`.
- No fake answer is generated.

## Future Adapter Requirements

- Adapter must be injected explicitly.
- Adapter must receive actor plus learner or household scope.
- Adapter response is validated by the router before serialization.
