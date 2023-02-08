import { t } from '@lingui/macro';
import { Button, ToolbarItem } from '@patternfly/react-core';
import * as React from 'react';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import {
  DistributionAPI,
  DistributionType,
  RemoteAPI,
  RemoteType,
} from 'src/api';
import {
  BaseHeader,
  EmptyStateNoData,
  EmptyStateUnauthorized,
  LoadingPageSpinner,
  LocalRepositoryTable,
  Main,
  RemoteForm,
  RemoteRepositoryTable,
  Tabs,
} from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths } from 'src/paths';
import { ParamHelper, mapErrorMessages } from 'src/utilities';

export class Repository {
  name: string;
  url: string;
  token: string;
  ssoUrl: string;
  yaml: string;
  sync: boolean;
}

interface IState {
  params: {
    page?: number;
    page_size?: number;
    tab?: string;
  };
  itemCount: number;
  loading: boolean;
  showRemoteFormModal: boolean;
  errorMessages: Object; // RemoteForm modal messages
  unauthorised: boolean;
  content: RemoteType[] | DistributionType[];
  remoteToEdit: RemoteType;
}

class RepositoryList extends React.Component<RouteComponentProps, IState> {
  nonQueryStringParams = ['repository'];
  // Used to save a copy of the remote before it's edited. This can be used to determine
  // which fields were changed when a user hits save.
  unModifiedRemote: RemoteType;

  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search, [
      'page',
      'page_size',
    ]);

    if (!params['page_size']) {
      params['page_size'] = 10;
    }

    if (!params['tab']) {
      params['tab'] = 'local';
    }

    if (!params['tab']) {
      params['tab'] = 'local';
    }

    this.state = {
      itemCount: 1,
      params: params,
      loading: false,
      showRemoteFormModal: false,
      content: [],
      remoteToEdit: undefined,
      errorMessages: {},
      unauthorised: false,
    };
  }

  componentDidMount() {
    if (!this.context.user || this.context.user.is_anonymous) {
      this.setState({ unauthorised: true, loading: false });
    } else {
      this.loadContent();
    }
  }

  render() {
    const {
      params,
      loading,
      content,
      remoteToEdit,
      showRemoteFormModal,
      errorMessages,
      unauthorised,
    } = this.state;

    const tabs = [
      { id: 'local', name: t`Local` },
      { id: 'remote', name: t`Remote` },
    ];
    return (
      <React.Fragment>
        {remoteToEdit && showRemoteFormModal && (
          <RemoteForm
            remote={remoteToEdit}
            updateRemote={(r: RemoteType) => this.setState({ remoteToEdit: r })}
            saveRemote={() => {
              const { remoteToEdit } = this.state;

              try {
                const distro_path =
                  remoteToEdit.repositories[0].distributions[0].base_path;

                RemoteAPI.smartUpdate(
                  distro_path,
                  remoteToEdit,
                  this.unModifiedRemote,
                )
                  .then((r) => {
                    this.setState(
                      {
                        errorMessages: {},
                        showRemoteFormModal: false,
                        remoteToEdit: undefined,
                      },
                      () => this.loadContent(),
                    );
                  })
                  .catch((err) =>
                    this.setState({ errorMessages: mapErrorMessages(err) }),
                  );
              } catch {
                this.setState({
                  errorMessages: {
                    __nofield: t`Can't update remote without a distribution attached to it.`,
                  },
                });
              }
            }}
            errorMessages={errorMessages}
            showModal={showRemoteFormModal}
            closeModal={() =>
              this.setState({ showRemoteFormModal: false, errorMessages: {} })
            }
          />
        )}
        <BaseHeader
          title={t`Repo Management`}
          pageControls={this.renderControls()}
        >
          {!loading && !unauthorised ? (
            <div className='header-bottom'>
              <div className='tab-link-container'>
                <div className='tabs'>
                  <Tabs
                    tabs={tabs}
                    params={params}
                    updateParams={(p) => {
                      // empty the content before updating the params to prevent
                      // rendering from breaking when the wrong content is loaded
                      this.setState({ content: [] }, () =>
                        this.updateParams(p, () => this.loadContent()),
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </BaseHeader>
        {loading ? (
          <LoadingPageSpinner />
        ) : unauthorised ? (
          <EmptyStateUnauthorized />
        ) : (
          this.renderContent(params, content)
        )}
      </React.Fragment>
    );
  }

  private renderContent(params, content) {
    const { user } = this.context;
    if (!!params.tab && params.tab.toLowerCase() === 'local') {
      return (
        <Main className='repository-list'>
          <section className='body'>
            <LocalRepositoryTable
              repositories={content}
              updateParams={this.updateParams}
            />
          </section>
        </Main>
      );
    }
    if (!!params.tab && params.tab.toLowerCase() === 'remote') {
      return content.length === 0 ? (
        <EmptyStateNoData
          title={t`No remote repositories yet`}
          description={t`Remote repositories will appear once added`}
        />
      ) : (
        <Main className='repository-list'>
          <section className='body'>
            <RemoteRepositoryTable
              remotes={content}
              updateParams={this.updateParams}
              editRemote={(remote: RemoteType) =>
                this.selectRemoteToEdit(remote)
              }
              syncRemote={(distro) =>
                RemoteAPI.sync(distro).then((result) => this.loadContent())
              }
              user={user}
              refreshRemotes={this.refreshContent}
            />
          </section>
        </Main>
      );
    }
  }

  private selectRemoteToEdit = (remote: RemoteType) => {
    // save a copy of the remote to diff against
    this.unModifiedRemote = { ...remote };

    this.setState({
      // create a copy of the remote to pass to the edit form, so that the
      // list of remotes doesn't get updated by accident.
      remoteToEdit: { ...remote },
      showRemoteFormModal: true,
    });
  };

  private refreshContent = () => {
    this.loadContent(false);
  };

  private loadContent = (showLoading = true) => {
    const { params } = this.state;
    this.setState({ loading: showLoading }, () => {
      if (params['tab'] == 'remote') {
        RemoteAPI.list(
          ParamHelper.getReduced(params, this.nonQueryStringParams),
        ).then((result) => {
          this.setState({
            loading: false,
            content: result.data.data,
            itemCount: result.data.meta.count,
          });
        });
      } else {
        DistributionAPI.list().then((result) => {
          this.setState({
            loading: false,
            content: result.data.data,
            itemCount: result.data.meta.count,
          });
        });
      }
    });
  };

  private renderControls() {
    if (this.state.params.tab == 'local') {
      return (
        <ToolbarItem>
          <Link to={Paths.token}>
            <Button>{t`Get token`}</Button>
          </Link>
        </ToolbarItem>
      );
    }
  }

  private get updateParams() {
    return ParamHelper.updateParamsMixin(this.nonQueryStringParams);
  }
}

export default withRouter(RepositoryList);
RepositoryList.contextType = AppContext;
