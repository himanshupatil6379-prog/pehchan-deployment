import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { notifyPopupParent, useAdmin, useAdminPage, useAdminRequest } from '../AdminContext.jsx';
import { DeleteSummary, NestedItems, NestedPerObject } from '../components/Nested.jsx';
import { errorPageFor } from './Errors.jsx';
import { apiPathFor, appVerboseName, capfirst, findModel, truncatewords } from '../utils.js';

/** admin/js/cancel.js */
function useCancel() {
  const navigate = useNavigate();
  const { isPopup } = useAdmin();
  return (e) => {
    e.preventDefault();
    if (isPopup && notifyPopupParent({ event: 'cancel' })) return;
    navigate(-1);
  };
}

/** Dialog-style confirmation card shared by both delete pages. */
function ConfirmCard({ title, tone = 'danger', icon = 'delete_forever', children, actions }) {
  return (
    <div className="adm-confirm">
      <section className="md-card adm-confirm__card" aria-labelledby="adm-confirm-title">
        <div className="adm-confirm__head">
          <span className={`adm-confirm__icon adm-confirm__icon--${tone}`} aria-hidden="true">
            <span className="md-icon">{icon}</span>
          </span>
          <h1 className="adm-confirm__title" id="adm-confirm-title">
            {title}
          </h1>
        </div>
        <div className="adm-confirm__body">{children}</div>
        {actions}
      </section>
    </div>
  );
}

/** admin/delete_confirmation.html */
export default function DeleteConfirmationPage() {
  const { app, model, id } = useParams();
  const location = useLocation();
  const page = useAdminPage();
  const request = useAdminRequest();
  const { appList } = useAdmin();
  const cancel = useCancel();
  const [busy, setBusy] = useState(false);

  const err = errorPageFor(page);
  if (err) return err;
  const data = page.data || {};
  const m = data.model || {};
  const entry = findModel(appList, app, model);
  const plural = m.verbose_name_plural || (entry ? entry.name : model);
  const objectName = m.verbose_name || model;
  const objectRepr = data.object_repr || '';
  const appName = appVerboseName(appList, app);
  const title = data.title || 'Are you sure?';

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await request(apiPathFor(location), { method: 'POST', data: { post: 'yes' } });
    if (!res.redirected && !res.handled) setBusy(false);
  };

  const perms = data.perms_lacking || [];
  const protectedObjs = data.protected || [];

  return (
    <AdminLayout
      title={title}
      contentTitle={false}
      bodyClass={`app-${app} model-${model} delete-confirmation`}
      breadcrumbs={[
        [appName, `/admin/${app}/`],
        [capfirst(plural), `/admin/${app}/${model}/`],
        [truncatewords(objectRepr, 18), `/admin/${app}/${model}/${id}/change/`],
        ['Delete'],
      ]}
      pending={!page.data}
    >
      {perms.length ? (
        <ConfirmCard title={title} tone="warning" icon="block">
          <p>
            Deleting the {objectName} &apos;{objectRepr}&apos; would result in deleting related objects, but your account doesn&apos;t
            have permission to delete the following types of objects:
          </p>
          <div className="adm-tree-wrap">
            <ul id="deleted-objects" className="adm-tree">
              <NestedItems items={perms} />
            </ul>
          </div>
        </ConfirmCard>
      ) : protectedObjs.length ? (
        <ConfirmCard title={title} tone="warning" icon="lock">
          <p>
            Deleting the {objectName} &apos;{objectRepr}&apos; would require deleting the following protected related objects:
          </p>
          <div className="adm-tree-wrap">
            <ul id="deleted-objects" className="adm-tree">
              <NestedItems items={protectedObjs} />
            </ul>
          </div>
        </ConfirmCard>
      ) : (
        <ConfirmCard
          title={title}
          actions={
            <form method="post" onSubmit={onSubmit} className="adm-confirm__form">
              <div className="adm-confirm__actions">
                <input type="hidden" name="post" value="yes" />
                <a href="#" className="button cancel-link md-btn md-btn--outlined" onClick={cancel}>
                  No, take me back
                </a>
                <button type="submit" className="md-btn md-btn--danger" value="Yes, I’m sure" aria-busy={busy ? 'true' : undefined}>
                  <span className="md-icon" aria-hidden="true">
                    delete
                  </span>
                  Yes, I’m sure
                </button>
              </div>
            </form>
          }
        >
          <p>
            Are you sure you want to delete the {objectName} &quot;{objectRepr}&quot;? All of the following related items will be
            deleted:
          </p>
          <DeleteSummary modelCount={data.model_count} />
          <h2 className="adm-confirm__section">Objects</h2>
          <div className="adm-tree-wrap">
            <ul id="deleted-objects" className="adm-tree">
              <NestedItems items={data.deleted_objects} />
            </ul>
          </div>
        </ConfirmCard>
      )}
    </AdminLayout>
  );
}

/** admin/delete_selected_confirmation.html (rendered by the changelist after the action POST). */
export function DeleteSelectedConfirmation({ confirm, model, app, appName, busy, onConfirm, onCancel }) {
  const objectsName = confirm.objects_name || model.verbose_name_plural;
  const perms = confirm.perms_lacking || [];
  const protectedObjs = confirm.protected || [];
  const ids = (confirm.payload && confirm.payload.selected) || [];
  const title = confirm.title || 'Are you sure?';

  const submit = (e) => {
    e.preventDefault();
    if (!busy) onConfirm();
  };
  const cancel = (e) => {
    e.preventDefault();
    onCancel();
  };

  return (
    <AdminLayout
      title={title}
      contentTitle={false}
      bodyClass={`app-${app} model-${model.model} delete-confirmation delete-selected-confirmation`}
      breadcrumbs={[
        [appName, `/admin/${app}/`],
        [capfirst(model.verbose_name_plural), `/admin/${app}/${model.model}/`],
        ['Delete multiple objects'],
      ]}
    >
      {perms.length ? (
        <ConfirmCard title={title} tone="warning" icon="block">
          <p>
            Deleting the selected {objectsName} would result in deleting related objects, but your account doesn&apos;t have
            permission to delete the following types of objects:
          </p>
          <div className="adm-tree-wrap">
            <ul className="adm-tree">
              <NestedItems items={perms} />
            </ul>
          </div>
        </ConfirmCard>
      ) : protectedObjs.length ? (
        <ConfirmCard title={title} tone="warning" icon="lock">
          <p>Deleting the selected {objectsName} would require deleting the following protected related objects:</p>
          <div className="adm-tree-wrap">
            <ul className="adm-tree">
              <NestedItems items={protectedObjs} />
            </ul>
          </div>
        </ConfirmCard>
      ) : (
        <ConfirmCard
          title={title}
          actions={
            <form method="post" onSubmit={submit} className="adm-confirm__form">
              <div className="adm-confirm__actions">
                {ids.map((pk) => (
                  <input key={pk} type="hidden" name="_selected_action" value={pk} />
                ))}
                <input type="hidden" name="action" value="delete_selected" />
                <input type="hidden" name="post" value="yes" />
                <a href="#" className="button cancel-link md-btn md-btn--outlined" onClick={cancel}>
                  No, take me back
                </a>
                <button type="submit" className="md-btn md-btn--danger" value="Yes, I’m sure" aria-busy={busy ? 'true' : undefined}>
                  <span className="md-icon" aria-hidden="true">
                    delete
                  </span>
                  Yes, I’m sure
                </button>
              </div>
            </form>
          }
        >
          <p>
            Are you sure you want to delete the selected {objectsName}? All of the following objects and their related items will be
            deleted:
          </p>
          <DeleteSummary modelCount={confirm.model_count} />
          <h2 className="adm-confirm__section">Objects</h2>
          <div className="adm-tree-wrap">
            <NestedPerObject items={confirm.deleted_objects} />
          </div>
        </ConfirmCard>
      )}
    </AdminLayout>
  );
}
