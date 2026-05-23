## 1. Persistencia y Entidades

- [x] 1.1 Crear la entidad `Company` en `apps/nest/src/modules/companies/entities/company.entity.ts` con los campos: NIT, razón social, sectores (text[]), regiones (text[]), indicadores financieros y capacidad de contratación.
- [x] 1.2 Generar y ejecutar una nueva migración de TypeORM para crear la tabla `companies`.

## 2. DTOs y Servicios

- [x] 2.1 Crear `CreateCompanyDto` y `UpdateCompanyDto` en `apps/nest/src/modules/companies/dto/` con validaciones para NIT, email y formatos de arreglo.
- [x] 2.2 Implementar los métodos CRUD en `CompaniesService` (findAll, findOne, create, update, remove).

## 3. API y Controladores

- [x] 3.1 Implement `CompaniesController` exponiendo los endpoints GET, POST, PATCH y DELETE bajo `/companies`.
- [x] 3.2 Asegurar que el `CompaniesModule` exporte el servicio y registre el repositorio de TypeORM.

## 4. Pruebas

- [x] 4.1 Crear pruebas unitarias para `CompaniesService` verificando la lógica de creación y manejo de duplicados.
- [x] 4.2 Realizar pruebas básicas de los endpoints mediante `curl` o herramientas similares una vez desplegado.
