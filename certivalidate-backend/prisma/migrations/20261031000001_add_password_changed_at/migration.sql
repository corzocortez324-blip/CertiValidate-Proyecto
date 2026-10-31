-- Fecha del último cambio de contraseña: invalida los access tokens anteriores
ALTER TABLE "Usuario" ADD COLUMN "password_changed_at" TIMESTAMP(3);
