import { CometChat } from '@cometchat-pro/chat';
import React from 'react';
import { connect } from 'react-redux';

import { Route, Redirect } from 'react-router-dom';
import VirgilService from '../VirgilService';
import { loaderStyle } from './../defaultPages/EndToEndEncryptionSampleApp/loader';
import { wrapperStyle } from './../defaultPages/App/style';
import { Global } from '@emotion/core';

class PrivateRoute extends React.Component {
  // Step 1 of 14
  // Maintain a state to show the loader while VirgilService is initializing
  // Hide it once the VirgilService has loaded.
  // Scroll down to see VirgilService initialization in componentDidMount
  state = {
    loader: false,
  };

  componentDidMount() {
    if (this.props.isLoggedIn === true) {
      (async () => {
        try {
          this.setState({
            loader: true,
          });
          // Step 2 of 14
          // Initialize the VirgilService.
          // "CometChatVirgilHelper" gets loaded on to the window object.
          // Refer to CometChatConversationList/index.js for step 3.
          await VirgilService({ CometChat });
          console.log('VirgilService initialized');
          this.setState({
            loader: false,
          });
        } catch (error) {
          // console.log(error)
        }
      })();
    }
  }

  render() {
    const { loader } = this.state;
    if (this.props.isLoggedIn) {
      return loader === true ? (
        <>
          <Global styles={loaderStyle} />
          <div css={wrapperStyle()}>
            <div className='loading'>Loading...</div>
          </div>
        </>
      ) : (
        <Route
          path={this.props.path}
          render={(props) => <this.props.component {...this.props} />}
        />
      );
    } else {
      return (
        <Redirect
          to={{ pathname: '/login', state: { from: this.props.location } }}
        />
      );
    }
  }
}

const mapStateToProps = (state) => {
  return {
    isLoggedIn: state.isLoggedIn,
  };
};

export default connect(mapStateToProps, null)(PrivateRoute);
