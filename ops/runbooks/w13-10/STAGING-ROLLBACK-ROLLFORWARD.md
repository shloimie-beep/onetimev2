# Staging Rollback And Rollforward

Record protected diagnostics runtime identity before deploy. Roll back only to the exact pre-deploy source and digest. Roll forward only to the exact candidate source and digest. Preserve source rebuild fallback. Database restore is a separately authorized last resort, never a routine rollback step.
