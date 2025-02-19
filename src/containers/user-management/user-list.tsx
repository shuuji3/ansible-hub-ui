import { t } from '@lingui/macro';
import {
  Button,
  DropdownItem,
  Label,
  LabelGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import UserPlusIcon from '@patternfly/react-icons/dist/esm/icons/user-plus-icon';
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { UserAPI, UserType } from 'src/api';
import {
  AlertList,
  AlertType,
  AppliedFilters,
  BaseHeader,
  CompoundFilter,
  DateComponent,
  DeleteUserModal,
  EmptyStateFilter,
  EmptyStateNoData,
  EmptyStateUnauthorized,
  ListItemActions,
  LoadingPageSpinner,
  Main,
  Pagination,
  SortTable,
  closeAlertMixin,
} from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath } from 'src/paths';
import {
  ParamHelper,
  RouteProps,
  chipGroupProps,
  errorMessage,
  filterIsSet,
  withRouter,
} from 'src/utilities';

interface IState {
  params: {
    page?: number;
    page_size?: number;
  };
  redirect?: string;
  users: UserType[];
  loading: boolean;
  itemCount: number;
  deleteUser: UserType;
  showDeleteModal: boolean;
  alerts: AlertType[];
  unauthorized: boolean;
  inputText: string;
}

class UserList extends React.Component<RouteProps, IState> {
  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search, [
      'page',
      'page_size',
    ]);

    if (!params['page_size']) {
      params['page_size'] = 10;
    }

    if (!params['sort']) {
      params['sort'] = 'username';
    }

    this.state = {
      deleteUser: undefined,
      showDeleteModal: false,
      params: params,
      users: [],
      loading: true,
      itemCount: 0,
      alerts: [],
      unauthorized: false,
      inputText: '',
    };
  }

  componentDidMount() {
    const { user, hasPermission } = this.context;
    if (!user || !hasPermission('galaxy.view_user')) {
      this.setState({ unauthorized: true });
    } else {
      this.queryUsers();
    }
  }

  render() {
    const {
      params,
      itemCount,
      loading,
      redirect,
      showDeleteModal,
      deleteUser,
      alerts,
      unauthorized,
    } = this.state;

    const { user, hasPermission } = this.context;

    if (redirect) {
      return <Navigate to={redirect} />;
    }

    return (
      <React.Fragment>
        <AlertList alerts={alerts} closeAlert={(i) => this.closeAlert(i)} />
        <DeleteUserModal
          isOpen={showDeleteModal}
          closeModal={this.closeModal}
          user={deleteUser}
          addAlert={(text, variant, description = undefined) =>
            this.setState({
              alerts: alerts.concat([
                { title: text, variant: variant, description: description },
              ]),
            })
          }
        />
        <BaseHeader title={t`Users`} />
        {unauthorized ? (
          <EmptyStateUnauthorized />
        ) : (
          <Main>
            <section className='body'>
              <div className='hub-toolbar'>
                <Toolbar>
                  <ToolbarContent>
                    <ToolbarGroup>
                      <ToolbarItem>
                        <CompoundFilter
                          inputText={this.state.inputText}
                          onChange={(input) =>
                            this.setState({ inputText: input })
                          }
                          updateParams={(p) =>
                            this.updateParams(p, () => this.queryUsers())
                          }
                          params={params}
                          filterConfig={[
                            {
                              id: 'username__contains',
                              title: t`Username`,
                            },
                            {
                              id: 'first_name__contains',
                              title: t`First name`,
                            },
                            {
                              id: 'last_name__contains',
                              title: t`Last name`,
                            },
                            {
                              id: 'email__contains',
                              title: t`Email`,
                            },
                          ]}
                        />
                      </ToolbarItem>
                    </ToolbarGroup>
                    {!!user && hasPermission('galaxy.add_user') ? (
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Link to={formatPath(Paths.createUser)}>
                            <Button>{t`Create`}</Button>
                          </Link>
                        </ToolbarItem>
                      </ToolbarGroup>
                    ) : null}
                  </ToolbarContent>
                </Toolbar>

                <Pagination
                  params={params}
                  updateParams={(p) =>
                    this.updateParams(p, () => this.queryUsers())
                  }
                  count={itemCount}
                  isTop
                />
              </div>
              <div>
                <AppliedFilters
                  updateParams={(p) => {
                    this.updateParams(p, () => this.queryUsers());
                    this.setState({ inputText: '' });
                  }}
                  params={params}
                  ignoredParams={['page_size', 'page', 'sort']}
                  niceNames={{
                    username__contains: t`Username`,
                    first_name__contains: t`First name`,
                    last_name__contains: t`Last name`,
                    email__contains: t`Email`,
                  }}
                />
              </div>
              {loading ? <LoadingPageSpinner /> : this.renderTable(params)}

              <Pagination
                params={params}
                updateParams={(p) =>
                  this.updateParams(p, () => this.queryUsers())
                }
                count={itemCount}
              />
            </section>
          </Main>
        )}
      </React.Fragment>
    );
  }

  private renderTable(params) {
    const { users } = this.state;
    if (users.length === 0) {
      return filterIsSet(params, [
        'username__contains',
        'first_name__contains',
        'last_name__contains',
        'email__contains',
      ]) ? (
        <EmptyStateFilter />
      ) : (
        <EmptyStateNoData
          title={t`No users yet`}
          description={t`Users will appear once created`}
          button={
            <Link to={formatPath(Paths.createUser)}>
              <Button variant={'primary'}>{t`Create`}</Button>
            </Link>
          }
        />
      );
    }

    const sortTableOptions = {
      headers: [
        {
          title: t`Username`,
          type: 'alpha',
          id: 'username',
        },
        {
          title: t`First name`,
          type: 'alpha',
          id: 'first_name',
          className: 'pf-m-wrap',
        },
        {
          title: t`Last name`,
          type: 'alpha',
          id: 'last_name',
          className: 'pf-m-wrap',
        },
        {
          title: t`Email`,
          type: 'alpha',
          id: 'email',
        },
        {
          id: 'groups',
          title: t`Groups`,
          type: 'none',
        },
        {
          title: t`Created`,
          type: 'numeric',
          id: 'date_joined',
        },
        {
          title: '',
          type: 'none',
          id: 'kebab',
        },
      ],
    };

    return (
      <table
        aria-label={t`User list`}
        className='hub-c-table-content pf-c-table'
      >
        <SortTable
          options={sortTableOptions}
          params={params}
          updateParams={(p) => this.updateParams(p, () => this.queryUsers())}
        />
        <tbody>{users.map((user, i) => this.renderTableRow(user, i))}</tbody>
      </table>
    );
  }

  private renderTableRow(user: UserType, index: number) {
    const dropdownItems = [];
    const { hasPermission } = this.context;
    if (!!this.context.user && hasPermission('galaxy.change_user')) {
      dropdownItems.push(
        <DropdownItem
          key='edit'
          component={
            <Link
              to={formatPath(Paths.editUser, {
                userID: user.id,
              })}
            >
              {t`Edit`}
            </Link>
          }
        />,
      );
    }
    if (!!this.context.user && hasPermission('galaxy.delete_user')) {
      dropdownItems.push(
        <DropdownItem key='delete' onClick={() => this.deleteUser(user)}>
          {t`Delete`}
        </DropdownItem>,
      );
    }
    return (
      <tr data-cy={`UserList-row-${user.username}`} key={index}>
        <td>
          <Link to={formatPath(Paths.userDetail, { userID: user.id })}>
            {user.username}
          </Link>

          {user.is_superuser && (
            <>
              {' '}
              <Tooltip
                content={t`Super users have all system permissions regardless of what groups they are in.`}
              >
                <Label icon={<UserPlusIcon />} color='orange'>
                  {t`Super user`}
                </Label>
              </Tooltip>
            </>
          )}
        </td>
        <td>{user.first_name}</td>
        <td>{user.last_name}</td>
        <td>{user.email}</td>
        <td>
          <LabelGroup {...chipGroupProps()}>
            {user.groups.map((g) => (
              <Label key={g.id}>{g.name}</Label>
            ))}
          </LabelGroup>
        </td>
        <td>
          <DateComponent date={user.date_joined} />
        </td>
        <ListItemActions kebabItems={dropdownItems} />
      </tr>
    );
  }

  private deleteUser = (user) => {
    this.setState({ deleteUser: user, showDeleteModal: true });
  };

  private closeModal = (didDelete) =>
    this.setState(
      {
        deleteUser: undefined,
        showDeleteModal: false,
      },
      () => {
        if (didDelete) {
          this.queryUsers();
        }
      },
    );

  private queryUsers() {
    this.setState({ loading: true }, () =>
      UserAPI.list(this.state.params)
        .then((result) =>
          this.setState({
            users: result.data.data,
            itemCount: result.data.meta.count,
            loading: false,
          }),
        )
        .catch((e) => {
          const { status, statusText } = e.response;
          this.setState({
            users: [],
            itemCount: 0,
            loading: false,
            alerts: [
              ...this.state.alerts,
              {
                variant: 'danger',
                title: t`Users list could not be displayed.`,
                description: errorMessage(status, statusText),
              },
            ],
          });
        }),
    );
  }

  private get updateParams() {
    return ParamHelper.updateParamsMixin();
  }

  private get closeAlert() {
    return closeAlertMixin('alerts');
  }
}

export default withRouter(UserList);

UserList.contextType = AppContext;
