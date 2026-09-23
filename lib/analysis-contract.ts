export const PARQUET_FILES = ["nodes.parquet", "edges.parquet", "transactions.parquet"] as const
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES * PARQUET_FILES.length + 1024 * 1024

export class AnalysisError extends Error {
  action: string
  status: number
  constructor(message: string, action: string, status = 400) {
    super(message)
    this.action = action
    this.status = status
  }
}

export function validateUpload(form: FormData) {
  const files = PARQUET_FILES.map((name) => {
    const entries = form.getAll(name)
    const file = entries[0]
    if (entries.length !== 1 || !(file instanceof File) || file.size === 0) {
      throw new AnalysisError(`Не выбран непустой файл ${name}.`, "Выберите все три parquet-файла одного комплекта выгрузки.")
    }
    if (file.name !== name) {
      throw new AnalysisError(`В поле ${name} выбран файл ${file.name}.`, `Выберите исходный ${name}, не меняя назначение файлов.`)
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new AnalysisError(`${name} превышает лимит 25 МиБ.`, "Используйте parquet-файлы кейса размером до 25 МиБ каждый.", 413)
    }
    return { name, file }
  })
  if ([...form.keys()].some((key) => key !== "source" && !PARQUET_FILES.includes(key as typeof PARQUET_FILES[number]))) {
    throw new AnalysisError("Переданы лишние поля или файлы.", "Отправьте только nodes.parquet, edges.parquet и transactions.parquet.")
  }
  return files
}

export function checkParquet(bytes: Uint8Array, name: string) {
  const magic = [80, 65, 82, 49] // PAR1: reject renamed text/archive files before Python.
  if (bytes.length < 12 || !magic.every((value, i) => bytes[i] === value && bytes[bytes.length - 4 + i] === value)) {
    throw new AnalysisError(`${name} не является обычным parquet-файлом.`, "Распакуйте архив организаторов и выберите исходные parquet, не ZIP или CSV.")
  }
}
