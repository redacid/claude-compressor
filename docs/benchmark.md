# Вимір ефекту

Дата: 2026-10-09. rtk 0.49.0, Claude Code 2.1.294, Node 22.

## Методика

`npm run bench -- [--md] <repo> ...` (`scripts/benchmark.js`) запускає фіксований набір команд лише для читання
у кожному репозиторії двічі: як є і в тому вигляді, в який її переписує плагін (той самий
`compress()` і адаптер rtk, що й у хуку). Вимірюються stdout+stderr: байти та приблизні токени (символи / 4).
«— (без змін)» означає, що плагін команду не чіпає (тут: `$(...)` — запобіжник проти підстановок).

Репозиторії: `compressor` (цей, 4 коміти), `obot-mcp-catalog` (474 коміти, 99 файлів),
`kubeconform` (398 комітів, 288 файлів; робоче дерево брудне, тому `git status` великий).

## Підсумок

| Репозиторій | Токени до | Токени після | Економія |
|---|---:|---:|---:|
| compressor | 6370 | 5721 | 10.2% |
| obot-mcp-catalog | 7224 | 3304 | 54.3% |
| kubeconform | 353401 | 39946 | 88.7% |

Найбільший ефект — на великому виводі: `git diff` (96%), `grep -rn` (90%), `find` (93%), `ls -la` (71–77%),
`git log` (35–79%). Майже без ефекту: `git log --stat`, `git diff --stat`, `git log --oneline | head` —
rtk пропускає їх як є.

Важливо: стиснення rtk **втратне**. Великий diff обрізається з підказкою
`[full diff: rtk git diff --no-compact]`, у `git log` з'являються маркери `[+N lines omitted]`.
Агент бачить, що вивід скорочено, і може попросити повний.

## Деталі

### compressor

| Команда | Переписано на | Байти до | Байти після | Токени до | Токени після | Економія |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 389 | 49 | 98 | 13 | 86.7% |
| `git log -20` | `rtk git log -20` | 1156 | 754 | 289 | 189 | 34.6% |
| `git log --stat -5` | `rtk git log --stat -5` | 2607 | 2607 | 652 | 652 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 16540 | 15380 | 4135 | 3845 | 7.0% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 187 | 187 | 47 | 47 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 187 | 187 | 47 | 47 | 0.0% |
| `git branch -a` | `rtk git branch -a` | 7 | 7 | 2 | 2 | 0.0% |
| `ls -la` | `rtk ls -la` | 781 | 181 | 196 | 46 | 76.5% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 652 | 555 | 163 | 139 | 14.7% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 2239 | 2239 | 560 | 560 | 0.0% |
| `wc -l $(git ls-files \| head -50)` | — (без змін) | 610 | 610 | 153 | 153 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 112 | 112 | 28 | 28 | 0.0% |
| **Разом** | | 25467 | 22868 | 6370 | 5721 | **10.2%** |

### obot-mcp-catalog

| Команда | Переписано на | Байти до | Байти після | Токени до | Токени після | Економія |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 100 | 49 | 25 | 12 | 52.0% |
| `git log -20` | `rtk git log -20` | 10876 | 2298 | 2719 | 575 | 78.9% |
| `git log --stat -5` | `rtk git log --stat -5` | 2095 | 2095 | 524 | 524 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 1416 | 929 | 354 | 233 | 34.2% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 994 | 994 | 249 | 249 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 2922 | 2074 | 731 | 519 | 29.0% |
| `git branch -a` | `rtk git branch -a` | 66 | 7 | 17 | 2 | 88.2% |
| `ls -la` | `rtk ls -la` | 5656 | 1401 | 1414 | 351 | 75.2% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 2300 | 890 | 575 | 223 | 61.2% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 0 | 0 | 0 | 0 | — |
| `wc -l $(git ls-files \| head -50)` | — (без змін) | 1326 | 1326 | 332 | 332 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 1135 | 1135 | 284 | 284 | 0.0% |
| **Разом** | | 28886 | 13198 | 7224 | 3304 | **54.3%** |

### kubeconform

| Команда | Переписано на | Байти до | Байти після | Токени до | Токени після | Економія |
|---|---|---:|---:|---:|---:|---:|
| `git status` | `rtk git status` | 16305 | 13153 | 4077 | 3289 | 19.3% |
| `git log -20` | `rtk git log -20` | 4780 | 2353 | 1195 | 589 | 50.7% |
| `git log --stat -5` | `rtk git log --stat -5` | 39483 | 39483 | 9871 | 9871 | 0.0% |
| `git show HEAD~1` | `rtk git show HEAD~1` | 25044 | 24196 | 6261 | 6049 | 3.4% |
| `git diff HEAD~3 --stat` | `rtk git diff HEAD~3 --stat` | 18204 | 18204 | 4551 | 4551 | 0.0% |
| `git diff HEAD~3` | `rtk git diff HEAD~3` | 1113088 | 40898 | 278200 | 10225 | 96.3% |
| `git branch -a` | `rtk git branch -a` | 158 | 67 | 40 | 17 | 57.5% |
| `ls -la` | `rtk ls -la` | 1572 | 450 | 393 | 113 | 71.2% |
| `find . -type f -not -path "./.git/*"` | `rtk find . -type f -not -path "./.git/*"` | 13125 | 965 | 3282 | 242 | 92.6% |
| `grep -rn "func\\|function" --include=*.go --include=*.js .` | `rtk grep -rn "func\\|function" --include=*.go --include=*.js .` | 179389 | 17268 | 44848 | 4317 | 90.4% |
| `wc -l $(git ls-files \| head -50)` | — (без змін) | 1742 | 1742 | 436 | 436 | — |
| `git log --oneline -50 \| head -20` | `rtk git log --oneline -50 \| head -20` | 985 | 985 | 247 | 247 | 0.0% |
| **Разом** | | 1413875 | 159764 | 353401 | 39946 | **88.7%** |

(У `compressor` на момент виміру було лише 3 коміти, тому `git diff HEAD~3` — це повідомлення про помилку.)

## Живий прогін у `claude -p`

Запуск: `claude -p --plugin-dir . --model haiku --output-format stream-json --verbose`
з `COMPRESSOR_LOG=<файл>`, у чистому середовищі (`env -i HOME PATH TERM LANG`).

**Прогін 1** — `--allowedTools "Bash(git status:*)" "Bash(git log:*)" "Bash(ls:*)" "Bash(rtk:*)"`:

```
rtk: git status -> rtk git status
rtk: git log -5 -> rtk git log -5
rtk: ls -la -> rtk ls -la
rtk: git status > /dev/null && echo done -> rtk git status > /dev/null && echo done
rtk: skip (redirect to file): git log -3 > .../out.txt
```

Усі чотири переписані команди виконались, агент отримав стиснений вивід rtk.
Редирект у файл плагін не чіпав, і його заблокував звичайний механізм дозволів
(запис поза робочою текою) — permission flow працює як без плагіна.

**Прогін 2** — дозволено лише `Bash(git status:*)`, команди `git status` і `ls -la`:
обидві переписано на `rtk ...` і обидві **відхилено** («This command requires approval»).

**Прогін 3** — без плагіна і без жодних правил: `ls -la` і `git diff --stat` виконались без запиту,
бо Claude Code сам дозволяє команди лише для читання.

## Знахідка: дозволи перевіряються для переписаної команди

Claude Code застосовує правила дозволів до команди **після** `updatedInput`. Тому:

- правило `Bash(git status:*)` не покриває `rtk git status`;
- вбудоване автодозволення команд лише для читання (`ls`, `git diff`, ...) не впізнає `rtk ...`.

Поточна поведінка (без `permissionDecision`) безпечна, але на практиці кожна переписана команда
вимагатиме підтвердження. Додати `Bash(rtk:*)` у дозволи — погана ідея: `rtk run` / `rtk proxy`
виконують довільні команди.

Як це робить власний хук rtk (`rtk hook claude`): `rtk rewrite` читає правила з settings.json
(користувача і проєкту) і повертає код 0, якщо оригінал **повністю** дозволено (усі частини ланцюжка),
3 — якщо правила нема або воно `ask`, 2 — якщо заборонено. На 0 хук rtk ставить
`permissionDecision: "allow"`, на 3 — нічого, на 2 — не переписує. Перевірено:
`git status && rm -rf zzz` → 3, `git status && git push` (push заборонено) → 2,
`git status && git status` → 0. Правил із `--allowedTools` і вбудованого автодозволення rtk не бачить.

## Рішення: варіант A (як у rtk)

Плагін ставить `permissionDecision: "allow"` **лише** коли `rtk rewrite` повернув 0, тобто правила
з settings.json уже дозволяють оригінальну команду повністю. На 3 рішення не ставиться (звичайний запит),
на 2 команда не переписується, і заборона спрацьовує на оригіналі. `rtk rewrite` запускається в `cwd`
з payload хука, щоб бачити `.claude/settings.json` проєкту. Права плагін не розширює.

Живий прогін (тимчасовий клон, `.claude/settings.json`: allow `git status`, `git log`; deny `git push`;
без `--allowedTools`):

```
rtk: git status -> rtk git status (allow)    виконано без запиту
rtk: git log -3 -> rtk git log -3 (allow)    виконано без запиту
rtk: ls -la -> rtk ls -la                    "requires approval" (правила нема)
git push                                     не переписано, відхилено deny-правилом
```

Обмеження: команди, які Claude Code дозволяє сам (лише читання: `ls`, `git diff`, ...), і правила з
`--allowedTools` rtk не бачить, тож для них після переписування буде запит. Щоб їх стискати без
запитів, додайте явні allow-правила для оригінальних команд, наприклад `Bash(ls:*)`, `Bash(git diff:*)`.
