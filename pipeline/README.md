# STRATA Money Graph pipeline

Воспроизводимый локальный пайплайн для кейса «Граф денег». Он читает три
parquet-файла, строит направленный граф, рассчитывает объяснимые признаки,
присваивает роли, выделяет сообщества и создаёт обязательные выгрузки.

## Запуск

Из корня репозитория:

```bash
cd pipeline
uv sync --locked
uv run python main.py --data ../data --out ../out --web ../public/data
```

Проверить уже созданные выгрузки:

```bash
uv run --project pipeline --locked money-graph --data data --out out --validate-only
```

Тесты:

```bash
uv run --project pipeline --locked pytest pipeline/tests
```

Кроме трёх CSV пайплайн создаёт `graph.json` и `run_log.json`. В них все `gid` записаны
строками, чтобы браузер не терял точность 64-битных идентификаторов.
