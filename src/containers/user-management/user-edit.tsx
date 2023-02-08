import * as React from 'react';
import { Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import { UserAPI, UserType } from 'src/api';
import { LoadingPageWithHeader, UserFormPage } from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath } from 'src/paths';
import { mapErrorMessages } from 'src/utilities';

interface IState {
  user: UserType;
  errorMessages: object;
}

class UserEdit extends React.Component<RouteComponentProps, IState> {
  constructor(props) {
    super(props);

    this.state = { user: undefined, errorMessages: {} };
  }

  componentDidMount() {
    const id = this.props.match.params['userID'];
    UserAPI.get(id)
      .then((result) => this.setState({ user: result.data }))
      .catch(() => this.props.history.push(Paths.notFound));
  }

  render() {
    const { user, errorMessages } = this.state;

    if (!user) {
      return <LoadingPageWithHeader></LoadingPageWithHeader>;
    }

    if (
      !this.context.user ||
      !this.context.user.model_permissions.change_user
    ) {
      return <Redirect to={Paths.notFound}></Redirect>;
    }

    return (
      <UserFormPage
        user={user}
        breadcrumbs={[
          { url: Paths.userList, name: 'Users' },
          {
            url: formatPath(Paths.userDetail, { userID: user.id }),
            name: user.username,
          },
          { name: 'Edit' },
        ]}
        title='Edit user'
        errorMessages={errorMessages}
        updateUser={(user, errorMessages) =>
          this.setState({ user: user, errorMessages: errorMessages })
        }
        saveUser={this.saveUser}
        onCancel={() => this.props.history.push(Paths.userList)}
      ></UserFormPage>
    );
  }
  private saveUser = () => {
    const { user } = this.state;
    UserAPI.update(user.id.toString(), user)
      .then(() => {
        //redirect to login page when password of logged user is changed
        if (this.context.user.id === user.id && user.password) {
          this.props.history.push(Paths.login);
        } else {
          this.props.history.push(Paths.userList);
        }
      })
      .catch((err) => {
        this.setState({ errorMessages: mapErrorMessages(err) });
      });
  };
}

export default withRouter(UserEdit);
UserEdit.contextType = AppContext;
