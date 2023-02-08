import * as React from 'react';
import { Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import { UserAPI, UserType } from 'src/api';
import { UserFormPage } from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths } from 'src/paths';
import { mapErrorMessages } from 'src/utilities';

interface IState {
  user: UserType;
  errorMessages: object;
}

class UserCreate extends React.Component<RouteComponentProps, IState> {
  constructor(props) {
    super(props);

    this.state = {
      user: {
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        groups: [],
      },
      errorMessages: {},
    };
  }

  render() {
    const { user, errorMessages } = this.state;
    if (!this.context.user || !this.context.user.model_permissions.add_user) {
      return <Redirect to={Paths.notFound}></Redirect>;
    }
    return (
      <UserFormPage
        user={user}
        breadcrumbs={[
          { url: Paths.userList, name: 'Users' },
          { name: 'Create new user' },
        ]}
        title='Create new user'
        errorMessages={errorMessages}
        updateUser={(user, errorMessages) =>
          this.setState({ user: user, errorMessages: errorMessages })
        }
        saveUser={this.saveUser}
        onCancel={() => this.props.history.push(Paths.userList)}
        isNewUser={true}
      ></UserFormPage>
    );
  }
  private saveUser = () => {
    const { user } = this.state;
    UserAPI.create(user)
      .then((result) => this.props.history.push(Paths.userList))
      .catch((err) => {
        this.setState({ errorMessages: mapErrorMessages(err) });
      });
  };
}

export default withRouter(UserCreate);
UserCreate.contextType = AppContext;
