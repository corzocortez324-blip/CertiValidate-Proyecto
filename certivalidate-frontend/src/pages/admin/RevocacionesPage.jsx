import React, { useState, useEffect, useCallback } from 'react';
import { certificadosApi } from '../../api/certificados.api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime } from '../../utils/helpers';

const LIMITE = 10;

/** Módulo de revocaciones: certificados revocados con su motivo y fecha. */
export function RevocacionesPage() {
  const [revocados, setRevocados] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await certificadosApi.listar({ page, limit: LIMITE, search, estado: 'revocado' });
      setRevocados(data.certificados || []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las revocaciones.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  const renderFilas = () => {
    if (loading) return <tr><td colSpan={5} className="empty-state">Cargando...</td></tr>;
    if (revocados.length === 0) return <tr><td colSpan={5} className="empty-state">No hay certificados revocados.</td></tr>;
    return revocados.map((c) => {
      const revocacion = c.revocaciones?.[0];
      return (
        <tr key={c.id}>
          <td className="mono">{c.codigo_unico}</td>
          <td>{`${c.snapshot_nombre ?? c.estudiante?.nombre ?? ''} ${c.snapshot_apellido ?? c.estudiante?.apellido ?? ''}`.trim() || '—'}</td>
          <td>{c.snapshot_institucion_nombre ?? c.institucion?.nombre ?? '—'}</td>
          <td><Badge variant="error">{revocacion?.motivo_codigo?.replace(/_/g, ' ') ?? 'Revocado'}</Badge></td>
          <td>{revocacion?.fecha_revocacion ? formatDateTime(revocacion.fecha_revocacion) : '—'}</td>
        </tr>
      );
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Revocaciones</h1>
          <p>Certificados revocados, con el motivo y la fecha de la revocación.</p>
        </div>
      </div>

      <Card>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label" htmlFor="revocaciones-buscar">Buscar</label>
          <input
            id="revocaciones-buscar"
            className="search-input"
            placeholder="Código o titular"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="table-overflow-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Titular</th>
                <th>Institución</th>
                <th>Motivo</th>
                <th>Fecha de revocación</th>
              </tr>
            </thead>
            <tbody>{renderFilas()}</tbody>
          </table>
        </div>
        {!loading && <p className="audit-user-email" style={{ marginTop: '0.75rem' }}>{total} revocación(es)</p>}
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
