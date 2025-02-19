import { Trans, t } from '@lingui/macro';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  Checkbox,
  DropdownItem,
  Text,
  Tooltip,
} from '@patternfly/react-core';
import ExternalLinkAltIcon from '@patternfly/react-icons/dist/esm/icons/external-link-alt-icon';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, Navigate } from 'react-router-dom';
import {
  CollectionAPI,
  CollectionVersionAPI,
  CollectionVersionSearch,
  GroupType,
  MyNamespaceAPI,
  NamespaceAPI,
  NamespaceType,
  RoleType,
  SignCollectionAPI,
} from 'src/api';
import {
  AccessTab,
  AlertList,
  AlertType,
  ClipboardCopy,
  CollectionFilter,
  CollectionList,
  DeleteCollectionModal,
  DeleteModal,
  EmptyStateNoData,
  ImportModal,
  LoadingPageWithHeader,
  Main,
  Pagination,
  PartnerHeader,
  SignAllCertificatesModal,
  StatefulDropdown,
  WisdomModal,
  closeAlertMixin,
} from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath, namespaceBreadcrumb } from 'src/paths';
import {
  DeleteCollectionUtils,
  ParamHelper,
  RouteProps,
  canSignNamespace,
  errorMessage,
  filterIsSet,
  getRepoURL,
  parsePulpIDFromURL,
  waitForTask,
  withRouter,
} from 'src/utilities';
import './namespace-detail.scss';

interface IState {
  alerts: AlertType[];
  canSign: boolean;
  collections: CollectionVersionSearch[];
  confirmDelete: boolean;
  deleteAll: boolean;
  deleteCollection: CollectionVersionSearch;
  filteredCount: number;
  group: GroupType;
  isDeletionPending: boolean;
  isNamespacePending: boolean;
  isOpenNamespaceModal: boolean;
  isOpenSignModal: boolean;
  isOpenWisdomModal: boolean;
  namespace: NamespaceType;
  params: {
    group?: number;
    keywords?: string;
    namespace?: string;
    page?: number;
    page_size?: number;
    sort?: string;
    tab?: string;
  };
  redirect: string;
  showControls: boolean;
  showGroupRemoveModal?: GroupType;
  showGroupSelectWizard?: { group?: GroupType; roles?: RoleType[] };
  showImportModal: boolean;
  showRoleRemoveModal?: string;
  showRoleSelectWizard?: { roles?: RoleType[] };
  unfilteredCount: number;
  updateCollection: CollectionVersionSearch;
  warning: string;
}

export class NamespaceDetail extends React.Component<RouteProps, IState> {
  nonAPIParams = ['tab', 'group'];

  // namespace is a positional url argument, so don't include it in the
  // query params
  nonQueryStringParams = ['namespace'];

  constructor(props) {
    super(props);
    const params = ParamHelper.parseParamString(props.location.search, [
      'page',
      'page_size',
    ]);

    params['namespace'] = props.routeParams.namespace;
    if (props.routeParams.repo && !params['repository_name']) {
      params['repository_name'] = props.routeParams.repo;
    }

    this.state = {
      alerts: [],
      canSign: false,
      collections: [],
      confirmDelete: false,
      deleteAll: true,
      deleteCollection: null,
      filteredCount: 0,
      group: null,
      isDeletionPending: false,
      isNamespacePending: false,
      isOpenNamespaceModal: false,
      isOpenSignModal: false,
      isOpenWisdomModal: false,
      namespace: null,
      params,
      redirect: null,
      showControls: false, // becomes true when my-namespaces doesn't 404
      showGroupRemoveModal: null,
      showGroupSelectWizard: null,
      showImportModal: false,
      showRoleRemoveModal: null,
      showRoleSelectWizard: null,
      unfilteredCount: 0,
      updateCollection: null,
      warning: '',
    };
  }

  componentDidMount() {
    this.load();

    this.setState({ alerts: this.context.alerts || [] });
    this.context.setAlerts([]);
  }

  componentDidUpdate(prevProps) {
    const params = ParamHelper.parseParamString(this.props.location.search, [
      'page',
      'page_size',
    ]);

    if (prevProps.location.search !== this.props.location.search) {
      params['namespace'] = this.props.routeParams.namespace;

      this.setState({
        params,
        group: this.filterGroup(params['group'], this.state.namespace.groups),
      });
    }

    if (
      prevProps.routeParams.repo !== this.props.routeParams.repo &&
      this.props.routeParams.repo &&
      (!params['repository_name'] ||
        params['repository_name'] === prevProps.routeParams.repo)
    ) {
      params['repository_name'] = this.props.routeParams.repo;
      this.setState({ params });
    }
  }

  filterGroup(groupId, groups) {
    return groupId ? groups.find(({ id }) => Number(groupId) === id) : null;
  }

  private updateGroups({ groups, alertSuccess, alertFailure, stateUpdate }) {
    const { name } = this.state.namespace;
    MyNamespaceAPI.update(name, {
      ...this.state.namespace,
      groups,
    })
      .then(() => {
        this.addAlert({
          title: alertSuccess,
          variant: 'success',
        });
        this.load(); // ensure reload() sets groups: null to trigger loading spinner
      })
      .catch(({ response: { status, statusText } }) => {
        this.addAlert({
          title: alertFailure,
          variant: 'danger',
          description: errorMessage(status, statusText),
        });
      })
      .finally(() => {
        this.setState(stateUpdate);
      });
  }

  render() {
    const {
      alerts,
      canSign,
      collections,
      confirmDelete,
      deleteCollection,
      filteredCount,
      isDeletionPending,
      isNamespacePending,
      isOpenNamespaceModal,
      isOpenWisdomModal,
      namespace,
      params,
      redirect,
      showControls,
      showImportModal,
      updateCollection,
      warning,
    } = this.state;

    if (redirect) {
      return <Navigate to={redirect} />;
    }

    if (!namespace) {
      return <LoadingPageWithHeader />;
    }

    const tabs = [
      { id: 'collections', name: t`Collections` },
      showControls && { id: 'cli-configuration', name: t`CLI configuration` },
      namespace.resources && { id: 'resources', name: t`Resources` },
      { id: 'access', name: t`Access` },
    ].filter(Boolean);

    const tab = params['tab'] || 'collections';

    const breadcrumbs = [
      namespaceBreadcrumb(),
      {
        name: namespace.name,
        url:
          tab === 'access'
            ? formatPath(Paths.namespaceDetail, {
                namespace: namespace.name,
              })
            : null,
      },
      tab === 'access'
        ? {
            name: t`Access`,
            url: params.group
              ? formatPath(
                  Paths.namespaceDetail,
                  {
                    namespace: namespace.name,
                  },
                  { tab: 'access' },
                )
              : null,
          }
        : null,
      tab === 'access' && params.group
        ? { name: t`Group ${params.group}` }
        : null,
    ].filter(Boolean);

    const repositoryUrl = getRepoURL('published');

    const noData =
      filteredCount === 0 &&
      !filterIsSet(params, [
        'is_signed',
        'keywords',
        'repository_name',
        'tags',
      ]);

    const updateParams = (params) =>
      this.updateParams(params, () => this.loadCollections());

    const ignoredParams = [
      'namespace',
      'page',
      'page_size',
      'sort',
      'tab',
      'group',
      'view_type',
    ];

    const { hasPermission } = this.context;

    const canEditOwners =
      this.state.namespace.related_fields.my_permissions?.includes(
        'galaxy.change_namespace',
      ) || hasPermission('galaxy.change_namespace');

    // remove ?group (access tab) when switching tabs
    const tabParams = { ...params };
    delete tabParams.group;

    const repository = params['repository_name'] || null;
    const deleteFromRepo = this.state.deleteAll
      ? null
      : deleteCollection?.repository?.name;

    return (
      <React.Fragment>
        <AlertList alerts={alerts} closeAlert={(i) => this.closeAlert(i)} />
        <ImportModal
          isOpen={showImportModal}
          onUploadSuccess={() =>
            this.setState({
              redirect: formatPath(
                Paths.myImports,
                {},
                {
                  namespace: namespace.name,
                },
              ),
            })
          }
          // onCancel
          setOpen={(isOpen, warn) => this.toggleImportModal(isOpen, warn)}
          collection={updateCollection?.collection_version}
          namespace={namespace.name}
        />
        <DeleteCollectionModal
          deleteCollection={deleteCollection}
          collections={collections}
          isDeletionPending={isDeletionPending}
          confirmDelete={confirmDelete}
          setConfirmDelete={(confirmDelete) => this.setState({ confirmDelete })}
          cancelAction={() => this.setState({ deleteCollection: null })}
          deleteAction={() =>
            this.setState({ isDeletionPending: true }, () =>
              DeleteCollectionUtils.deleteCollection({
                collection: deleteCollection,
                setState: (state) => this.setState(state),
                load: () => this.load(),
                redirect: false,
                addAlert: (alert) => this.addAlert(alert),
                deleteFromRepo,
              }),
            )
          }
          deleteFromRepo={deleteFromRepo}
        />
        {isOpenNamespaceModal && (
          <DeleteModal
            spinner={isNamespacePending}
            cancelAction={this.closeModal}
            deleteAction={this.deleteNamespace}
            title={t`Delete namespace?`}
            isDisabled={!confirmDelete || isNamespacePending}
          >
            <>
              <Text className='delete-namespace-modal-message'>
                <Trans>
                  Deleting <b>{namespace.name}</b> and its data will be lost.
                </Trans>
              </Text>
              <Checkbox
                isChecked={confirmDelete}
                onChange={(val) => this.setState({ confirmDelete: val })}
                label={t`I understand that this action cannot be undone.`}
                id='delete_confirm'
              />
            </>
          </DeleteModal>
        )}
        {isOpenWisdomModal && (
          <WisdomModal
            addAlert={(alert) => this.addAlert(alert)}
            closeAction={() => this.setState({ isOpenWisdomModal: false })}
            scope={'namespace'}
            reference={this.state.namespace.name}
          />
        )}
        {warning ? (
          <Alert
            className='hub-c-alert-namespace'
            variant='warning'
            title={warning}
            actionClose={
              <AlertActionCloseButton
                onClose={() => this.setState({ warning: '' })}
              />
            }
          />
        ) : null}
        <PartnerHeader
          namespace={namespace}
          breadcrumbs={breadcrumbs}
          tabs={tabs}
          params={tabParams}
          updateParams={(p) => this.updateParams(p)}
          pageControls={this.renderPageControls()}
          filters={
            tab === 'collections' ? (
              <div>
                <div className='hub-toolbar hub-toolbar-left'>
                  <CollectionFilter
                    ignoredParams={ignoredParams}
                    params={params}
                    updateParams={updateParams}
                  />

                  <div className='hub-pagination-container'>
                    <Pagination
                      params={params}
                      updateParams={updateParams}
                      count={filteredCount}
                      isTop
                    />
                  </div>
                </div>
              </div>
            ) : null
          }
        />
        <Main>
          {tab === 'collections' ? (
            noData ? (
              <EmptyStateNoData
                title={t`No collections yet`}
                description={t`Collections will appear once uploaded`}
                button={
                  this.state.showControls && (
                    <Button
                      onClick={() => this.setState({ showImportModal: true })}
                    >{t`Upload collection`}</Button>
                  )
                }
              />
            ) : (
              <section className='body'>
                <CollectionList
                  updateParams={updateParams}
                  params={params}
                  ignoredParams={ignoredParams}
                  collections={collections}
                  itemCount={filteredCount}
                  displaySignatures={
                    this.context.featureFlags.display_signatures
                  }
                  collectionControls={(collection) =>
                    this.renderCollectionControls(collection)
                  }
                />
              </section>
            )
          ) : null}
          {tab === 'cli-configuration' ? (
            <section className='body'>
              <div>
                <div>
                  <Trans>
                    <b>Note:</b> Use this URL to configure ansible-galaxy to
                    upload collections to this namespace. More information on
                    ansible-galaxy configurations can be found{' '}
                    <a
                      href='https://docs.ansible.com/ansible/latest/galaxy/user_guide.html#configuring-the-ansible-galaxy-client'
                      target='_blank'
                      rel='noreferrer'
                    >
                      here
                    </a>
                    <span>&nbsp;</span>
                    <ExternalLinkAltIcon />.
                  </Trans>
                </div>
                <ClipboardCopy isReadOnly>{repositoryUrl}</ClipboardCopy>
              </div>
            </section>
          ) : null}
          {tab === 'resources' ? this.renderResources(namespace) : null}
          {tab === 'access' ? (
            <AccessTab
              showGroupRemoveModal={this.state.showGroupRemoveModal}
              showGroupSelectWizard={this.state.showGroupSelectWizard}
              showRoleRemoveModal={this.state.showRoleRemoveModal}
              showRoleSelectWizard={this.state.showRoleSelectWizard}
              canEditOwners={canEditOwners}
              group={this.state.group}
              groups={namespace.groups}
              name={namespace.name}
              pulpObjectType='pulp_ansible/namespaces'
              selectRolesMessage={t`The selected roles will be added to this specific namespace.`}
              updateProps={(prop) => {
                this.setState(prop);
              }}
              addGroup={(group, roles) => {
                const { groups, name } = namespace;
                const newGroup = {
                  ...group,
                  object_roles: roles.map(({ name }) => name),
                };
                const newGroups = [...groups, newGroup];

                this.updateGroups({
                  groups: newGroups,
                  alertSuccess: t`Group "${group.name}" has been successfully added to "${name}".`,
                  alertFailure: t`Group "${group.name}" could not be added to "${name}".`,
                  stateUpdate: { showGroupSelectWizard: null },
                });
              }}
              removeGroup={(group) => {
                const { name, groups } = namespace;
                const newGroups = groups.filter((g) => g !== group);
                this.updateGroups({
                  groups: newGroups,
                  alertSuccess: t`Group "${group.name}" has been successfully removed from "${name}".`,
                  alertFailure: t`Group "${group.name}" could not be removed from "${name}".`,
                  stateUpdate: { showGroupRemoveModal: null },
                });
              }}
              addRole={(group, roles) => {
                const { name, groups } = namespace;
                const newGroup = {
                  ...group,
                  object_roles: [
                    ...group.object_roles,
                    ...roles.map(({ name }) => name),
                  ],
                };
                const newGroups = groups.map((g) =>
                  g === group ? newGroup : g,
                );

                this.updateGroups({
                  groups: newGroups,
                  alertSuccess: t`Group "${group.name}" roles successfully updated in "${name}".`,
                  alertFailure: t`Group "${group.name}" roles could not be update in "${name}".`,
                  stateUpdate: { showRoleSelectWizard: null },
                });
              }}
              removeRole={(role, group) => {
                const { name, groups } = namespace;
                const newGroup = {
                  ...group,
                  object_roles: group.object_roles.filter(
                    (name) => name !== role,
                  ),
                };
                const newGroups = groups.map((g) =>
                  g === group ? newGroup : g,
                );

                this.updateGroups({
                  groups: newGroups,
                  alertSuccess: t`Group "${group.name}" roles successfully updated in "${name}".`,
                  alertFailure: t`Group "${group.name}" roles could not be update in "${name}".`,
                  stateUpdate: { showRoleRemoveModal: null },
                });
              }}
              urlPrefix={formatPath(Paths.namespaceDetail, {
                namespace: namespace.name,
              })}
            />
          ) : null}
        </Main>
        {canSign && (
          <SignAllCertificatesModal
            name={this.state.namespace.name}
            isOpen={this.state.isOpenSignModal}
            onSubmit={() => this.signAllCertificates(namespace, repository)}
            onCancel={() => this.setState({ isOpenSignModal: false })}
          />
        )}
      </React.Fragment>
    );
  }

  private handleCollectionAction(pulp_href, action) {
    const collection = this.state.collections.find(
      (c) => c.collection_version.pulp_href === pulp_href,
    );
    const { name } = collection.collection_version;

    switch (action) {
      case 'upload':
        this.setState({
          updateCollection: collection,
          showImportModal: true,
        });
        break;
      case 'deprecate':
        this.setState({
          alerts: [
            ...this.state.alerts,
            {
              variant: 'info',
              title: t`Deprecation status update starting for collection "${name}".`,
            },
          ],
        });
        CollectionAPI.setDeprecation(collection)
          .then((result) => {
            const taskId = parsePulpIDFromURL(result.data.task);
            return waitForTask(taskId).then(() => {
              const title = collection.is_deprecated
                ? t`Collection "${name}" has been successfully undeprecated.`
                : t`Collection "${name}" has been successfully deprecated.`;
              this.setState({
                alerts: [
                  ...this.state.alerts,
                  {
                    title: title,
                    variant: 'success',
                  },
                ],
              });
              return this.loadCollections();
            });
          })
          .catch(() => {
            this.setState({
              warning: t`API Error: Failed to set deprecation.`,
            });
          });
        break;
    }
  }

  private renderResources(namespace: NamespaceType) {
    return (
      <div className='pf-c-content preview'>
        <ReactMarkdown>{namespace.resources}</ReactMarkdown>
      </div>
    );
  }

  private signAllCertificates(namespace: NamespaceType, repository: string) {
    const errorAlert = (status: string | number = 500): AlertType => ({
      variant: 'danger',
      title: t`Failed to sign all collections.`,
      description: t`API Error: ${status}`,
    });

    SignCollectionAPI.sign({
      signing_service: this.context.settings.GALAXY_COLLECTION_SIGNING_SERVICE,
      repository_name: repository,
      namespace: namespace.name,
    })
      .then((result) => {
        // FIXME: use taskAlert
        this.setState({
          alerts: [
            ...this.state.alerts,
            {
              id: 'loading-signing',
              variant: 'success',
              title: t`Signing started for all collections in namespace "${namespace.name}".`,
            },
          ],
          isOpenSignModal: false,
        });

        waitForTask(result.data.task_id)
          .then(() => {
            this.loadCollections();
          })
          .catch((error) => {
            this.setState({
              alerts: [...this.state.alerts, errorAlert(error)],
            });
          })
          .finally(() => {
            this.setState({
              alerts: this.state.alerts.filter(
                (x) => x?.id !== 'loading-signing',
              ),
            });
          });
      })
      .catch((error) => {
        // The request failed in the first place
        this.setState({
          alerts: [...this.state.alerts, errorAlert(error.response.status)],
          isOpenSignModal: false,
        });
      });
  }

  private loadAllCollections(params) {
    return CollectionVersionAPI.list({
      ...params,
      is_highest: true,
      namespace: this.props.routeParams.namespace,
      repository_label: '!hide_from_search',
    });
  }

  private loadCollections() {
    return this.loadAllCollections(
      ParamHelper.getReduced(this.state.params, this.nonAPIParams),
    ).then((result) => {
      this.setState({
        collections: result.data.data,
        filteredCount: result.data.meta.count,
      });
    });
  }

  private load() {
    Promise.all([
      this.loadCollections(),
      this.loadAllCollections({
        page: 1,
        page_size: 1,
      }),
      NamespaceAPI.get(this.props.routeParams.namespace, {
        include_related: 'my_permissions',
      }),
      MyNamespaceAPI.get(this.props.routeParams.namespace, {
        include_related: 'my_permissions',
      }).catch((e) => {
        // this needs fixing on backend to return nothing in these cases with 200 status
        // if view only mode is enabled disregard errors and hope
        if (
          this.context.user.is_anonymous &&
          this.context.settings.GALAXY_ENABLE_UNAUTHENTICATED_COLLECTION_ACCESS
        ) {
          return null;
        }

        // expecting 404 - it just means we can not edit the namespace (unless both NamespaceAPI and MyNamespaceAPI fail)
        return e.response && e.response.status === 404
          ? null
          : Promise.reject(e);
      }),
    ])
      .then(
        ([
          _collections,
          {
            data: {
              meta: { count: unfilteredCount },
            },
          },
          { data: namespace },
          myNamespace,
        ]) => {
          this.setState({
            canSign: canSignNamespace(this.context, myNamespace?.data),
            group: this.filterGroup(
              this.state.params['group'],
              namespace['groups'],
            ),
            namespace,
            showControls: !!myNamespace,
            unfilteredCount,
          });
        },
      )
      .catch(() => {
        this.setState({ redirect: formatPath(Paths.notFound) });
      });
  }

  private get updateParams() {
    return ParamHelper.updateParamsMixin(this.nonQueryStringParams);
  }

  private renderPageControls() {
    const { canSign, collections, unfilteredCount } = this.state;
    const { can_upload_signatures } = this.context.featureFlags;
    const { ai_deny_index } = this.context.featureFlags;
    const { hasPermission } = this.context;
    const repository = this.state.params['repository_name'] || null;

    const dropdownItems = [
      <DropdownItem
        key='1'
        component={
          <Link
            to={formatPath(Paths.editNamespace, {
              namespace: this.state.namespace.name,
            })}
          >
            {t`Edit namespace`}
          </Link>
        }
      />,
      hasPermission('galaxy.delete_namespace') && (
        <React.Fragment key={'2'}>
          {unfilteredCount === 0 ? (
            <DropdownItem
              onClick={() => this.setState({ isOpenNamespaceModal: true })}
            >{t`Delete namespace`}</DropdownItem>
          ) : (
            <Tooltip
              isVisible={false}
              content={
                <Trans>
                  Cannot delete namespace until <br />
                  collections&apos; dependencies have <br />
                  been deleted
                </Trans>
              }
              position='left'
            >
              <DropdownItem isDisabled>{t`Delete namespace`}</DropdownItem>
            </Tooltip>
          )}
        </React.Fragment>
      ),
      <DropdownItem
        key='3'
        component={
          <Link
            to={formatPath(
              Paths.myImports,
              {},
              {
                namespace: this.state.namespace.name,
              },
            )}
          >
            {t`Imports`}
          </Link>
        }
      />,
      canSign &&
        !can_upload_signatures &&
        (repository ? (
          <DropdownItem
            key='sign-collections'
            data-cy='sign-all-collections-button'
            onClick={() => this.setState({ isOpenSignModal: true })}
          >
            {t`Sign all collections in ${repository}`}
          </DropdownItem>
        ) : (
          <DropdownItem
            key='sign-collections'
            isDisabled
            description={t`Please select a repository filter`}
          >
            {t`Sign all collections`}
          </DropdownItem>
        )),
      ai_deny_index && (
        <DropdownItem
          key='wisdom-settings'
          onClick={() => this.setState({ isOpenWisdomModal: true })}
        >
          {t`Ansible Lightspeed settings`}
        </DropdownItem>
      ),
    ].filter(Boolean);
    if (!this.state.showControls) {
      return <div className='hub-namespace-page-controls' />;
    }
    return (
      <div className='hub-namespace-page-controls' data-cy='kebab-toggle'>
        {' '}
        {collections.length !== 0 && (
          <Button
            onClick={() => this.setState({ showImportModal: true })}
          >{t`Upload collection`}</Button>
        )}
        {dropdownItems.length > 0 && (
          <div data-cy='ns-kebab-toggle'>
            <StatefulDropdown items={dropdownItems} />
          </div>
        )}
      </div>
    );
  }

  private toggleImportModal(isOpen: boolean, warning?: string) {
    const newState = { showImportModal: isOpen };
    if (warning) {
      newState['warning'] = warning;
    }

    if (!isOpen) {
      newState['updateCollection'] = null;
    }

    this.setState(newState);
  }

  private deleteNamespace = () => {
    const {
      namespace: { name },
    } = this.state;
    this.setState({ isNamespacePending: true }, () =>
      NamespaceAPI.delete(name)
        .then(() => {
          this.setState({
            redirect: namespaceBreadcrumb().url,
            confirmDelete: false,
            isNamespacePending: false,
          });
          this.context.queueAlert({
            variant: 'success',
            title: (
              <Trans>
                Namespace &quot;{name}&quot; has been successfully deleted.
              </Trans>
            ),
          });
        })
        .catch((e) => {
          const { status, statusText } = e.response;
          this.setState(
            {
              isOpenNamespaceModal: false,
              confirmDelete: false,
              isNamespacePending: false,
            },
            () => {
              this.setState({
                alerts: [
                  ...this.state.alerts,
                  {
                    variant: 'danger',
                    title: t`Namespace "${name}" could not be deleted.`,
                    description: errorMessage(status, statusText),
                  },
                ],
              });
            },
          );
        }),
    );
  };

  private closeModal = () => {
    this.setState({ isOpenNamespaceModal: false, confirmDelete: false });
  };

  private addAlert(alert: AlertType) {
    this.setState({
      alerts: [...this.state.alerts, alert],
    });
  }

  get closeAlert() {
    return closeAlertMixin('alerts');
  }

  private renderCollectionControls(collection: CollectionVersionSearch) {
    const { hasPermission } = this.context;
    const hasObjectPermission = (permission, namespace) =>
      namespace?.related_fields?.my_permissions?.includes?.(permission);
    const { showControls } = this.state;
    const { display_repositories, ai_deny_index } = this.context.featureFlags;
    const canDeleteCommunityCollection =
      ai_deny_index &&
      hasObjectPermission('galaxy.change_namespace', this.state.namespace);

    if (!showControls) {
      return;
    }

    return {
      uploadButton: (
        <Button
          onClick={() =>
            this.handleCollectionAction(
              collection.collection_version.pulp_href,
              'upload',
            )
          }
          variant='secondary'
        >
          {t`Upload new version`}
        </Button>
      ),
      dropdownMenu: (
        <StatefulDropdown
          items={[
            DeleteCollectionUtils.deleteMenuOption({
              canDeleteCollection:
                hasPermission('ansible.delete_collection') ||
                canDeleteCommunityCollection,
              noDependencies: null,
              onClick: () =>
                DeleteCollectionUtils.tryOpenDeleteModalWithConfirm({
                  addAlert: (alert) => this.addAlert(alert),
                  setState: (state) => this.setState(state),
                  collection,
                  deleteAll: true,
                }),
              deleteAll: true,
              display_repositories: display_repositories,
            }),
            DeleteCollectionUtils.deleteMenuOption({
              canDeleteCollection:
                hasPermission('ansible.delete_collection') ||
                canDeleteCommunityCollection,
              noDependencies: null,
              onClick: () =>
                DeleteCollectionUtils.tryOpenDeleteModalWithConfirm({
                  addAlert: (alert) => this.addAlert(alert),
                  setState: (state) => this.setState(state),
                  collection,
                  deleteAll: false,
                }),
              deleteAll: false,
              display_repositories: display_repositories,
            }),
            <DropdownItem
              onClick={() =>
                this.handleCollectionAction(
                  collection.collection_version.pulp_href,
                  'deprecate',
                )
              }
              key='deprecate'
            >
              {collection.is_deprecated ? t`Undeprecate` : t`Deprecate`}
            </DropdownItem>,
          ].filter(Boolean)}
          ariaLabel='collection-kebab'
        />
      ),
    };
  }
}

NamespaceDetail.contextType = AppContext;

export default withRouter(NamespaceDetail);
