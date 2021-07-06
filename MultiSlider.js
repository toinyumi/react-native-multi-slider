import React from 'react';
import { Text } from 'react-native';

import {
  StyleSheet,
  PanResponder,
  View,
  Platform,
  Dimensions,
  I18nManager,
  ImageBackground,
} from 'react-native';

import DefaultMarker from './DefaultMarker';
import DefaultLabel from './DefaultLabel';
import { createArray, valueToPosition, positionToValue } from './converters';

export default class MultiSlider extends React.Component {
  static defaultProps = {
    loadingProgress: 0,
    values: [0],
    onValuesChangeStart: () => {},
    onValuesChange: values => {},
    onValuesChangeFinish: values => {},
    onMarkersPosition: values => {},
    step: 1,
    min: 0,
    max: 10,
    touchDimensions: {
      height: 50,
      width: 50,
      borderRadius: 15,
      slipDisplacement: 200,
    },
    customMarker: DefaultMarker,
    customMarkerLeft: DefaultMarker,
    customMarkerRight: DefaultMarker,
    customLabel: DefaultLabel,
    markerOffsetX: 0,
    markerOffsetY: 0,
    markerSize: 0,
    sliderLength: 280,
    onToggleOne: undefined,
    onToggleTwo: undefined,
    stepsAs: [],
    showSteps: false,
    showStepMarkers: true,
    showStepLabels: true,
    enabledOne: true,
    enabledTwo: true,
    allowOverlap: false,
    snapped: false,
    smoothSnapped: false,
    vertical: false,
    minMarkerOverlapDistance: 0,
    minMarkerOverlapStepDistance: 0,
    testID: '',
    allowSliderClick: false,
  };

  constructor(props) {
    super(props);

    if (
      this.props.minMarkerOverlapDistance > 0 &&
      this.props.minMarkerOverlapStepDistance > 0
    ) {
      console.error(
        'You should provide either "minMarkerOverlapDistance" or "minMarkerOverlapStepDistance", not both. Expect unreliable results.',
      );
    }

    this.optionsArray =
      this.props.optionsArray ||
      createArray(this.props.min, this.props.max, this.props.step);
    this.stepLength = this.props.sliderLength / (this.optionsArray.length - 1);

    var initialValues = this.props.values.map(value =>
      valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      ),
    );

    var tempStepsAs = {};
    this.props.stepsAs.forEach(step => {
      if (step?.index !== undefined) {
        tempStepsAs[step?.index] = step;
      }
    });

    this.stepsAs = {};
    this.optionsArray.forEach((ops, index) => {
      if (tempStepsAs[index]) {
        var step = tempStepsAs[index];
        this.stepsAs[index] = {
          stepLabel: step?.stepLabel ? step.stepLabel : ops,
          suffix: step?.suffix ? step.suffix : '',
          prefix: step?.prefix ? step.prefix : '',
        };
      } else {
        this.stepsAs[index] = {
          stepLabel: ops,
          suffix: '',
          prefix: '',
        };
      }
    });

    this.state = {
      pressedOne: true,
      valueOne: this.props.values[0],
      valueTwo: this.props.values[1],
      pastOne: initialValues[0],
      pastTwo: initialValues[1],
      positionOne: initialValues[0],
      positionTwo: initialValues[1],
    };

    this.subscribePanResponder();
  }

  subscribePanResponder = () => {
    var customPanResponder = (start, move, end, isClicked = false) => {
      return PanResponder.create({
        onStartShouldSetPanResponder: (evt, gestureState) => true,
        onStartShouldSetPanResponderCapture: (evt, gestureState) => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => false,
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => false,
        onPanResponderGrant: (evt, gestureState) => {
          if (!isClicked) start();
        },
        onPanResponderMove: (evt, gestureState) => {
          if (!isClicked) move(gestureState);
        },
        onPanResponderTerminationRequest: (evt, gestureState) => true,
        onPanResponderRelease: (evt, gestureState) => {
          if (isClicked && Math.abs(gestureState.dx) <= 1) {
            /*if its coming from slider and distance is not covered than only move the thumb
              because we are preventing it to move when user drag on slider*/
            //   console.log("onStartShouldSetPanResponder else " + (Math.abs(gestureState.dx) >= 1) + " " + gestureState.dx)
            move(gestureState);
          } else {
            end(gestureState);
          }
        },
        onPanResponderTerminate: (evt, gestureState) => {
          if (!isClicked) end(gestureState);
        },
        onShouldBlockNativeResponder: (evt, gestureState) => false,
      });
    };

    this._panResponderBetween = customPanResponder(
      gestureState => {
        this.startOne(gestureState);
        this.startTwo(gestureState);
      },
      gestureState => {
        this.moveOne(gestureState);
        this.moveTwo(gestureState);
      },
      gestureState => {
        this.endOne(gestureState);
        this.endTwo(gestureState);
      },
    );

    this._panResponderOneTapped = customPanResponder(
      this.startOne,
      this.moveOneTapped,
      this.endOne,
      true
    );

    this._panResponderOne = customPanResponder(
      this.startOne,
      this.moveOne,
      this.endOne,
    );
    this._panResponderTwo = customPanResponder(
      this.startTwo,
      this.moveTwo,
      this.endTwo,
    );
  };

  startOne = () => {
    if (this.props.enabledOne) {
      this.props.onValuesChangeStart();
      this.setState({
        onePressed: !this.state.onePressed,
      });
    }
  };

  startTwo = () => {
    if (this.props.enabledTwo) {
      this.props.onValuesChangeStart();
      this.setState({
        twoPressed: !this.state.twoPressed,
      });
    }
  };

  moveOneTapped = gestureState => {
    if (!this.props.enabledOne) {
      return;
    }
    const accumDistance = this.props.vertical
        ? -gestureState.dy
        : gestureState.dx;
    const accumDistanceDisplacement = this.props.vertical
        ? gestureState.dx
        : gestureState.dy;
    let unconfined;
    gestureState.x0 = gestureState.x0 - 20; //default slide x to -20 because thumb value is much So, -20 is perfect
    unconfined = gestureState.x0;
    var bottom = 0;
    var trueTop =
        this.state.positionTwo -
        (this.props.allowOverlap
            ? 0
            : this.props.minMarkerOverlapDistance > 0
                ? this.props.minMarkerOverlapDistance
                : this.stepLength);
    var top = trueTop === 0 ? 0 : trueTop || this.props.sliderLength;
    var confined =
        unconfined < bottom ? bottom : unconfined > top ? top : unconfined;
    var slipDisplacement = this.props.touchDimensions.slipDisplacement;
    if (
        Math.abs(accumDistanceDisplacement) < slipDisplacement ||
        !slipDisplacement
    ) {
      var value = positionToValue(
          confined,
          this.optionsArray,
          this.props.sliderLength,
      );
      var snapped = valueToPosition(
          value,
          this.optionsArray,
          this.props.sliderLength,
      );
      this.setState({
        positionOne: this.props.snapped ? snapped : confined,
      });
      if (value !== this.state.valueOne) {
        this.setState(
            {
              valueOne: value,
            },
            () => {
              var change = [this.state.valueOne];
              if (this.state.valueTwo) {
                change.push(this.state.valueTwo);
              }
              this.props.onValuesChange(change);
              this.props.onMarkersPosition([
                this.state.positionOne,
              ]);
              this.setState({
                pastOne: this.state.positionOne
              });
              //  console.log("tapped => position when tap : " + this.state.positionOne + " position two is " + this.state.positionTwo)
            },
        );
        this.endOne(value);
      }
    }
  };

  moveOne = gestureState => {
    if (!this.props.enabledOne) {
      return;
    }

    const accumDistance = this.props.vertical
      ? -gestureState.dy
      : gestureState.dx;
    const accumDistanceDisplacement = this.props.vertical
      ? gestureState.dx
      : gestureState.dy;

    const unconfined = I18nManager.isRTL
      ? this.state.pastOne - accumDistance
      : accumDistance + this.state.pastOne;
    var bottom = this.props.markerSize / 2;
    var trueTop =
      this.state.positionTwo -
      (this.props.allowOverlap
        ? 0
        : this.props.minMarkerOverlapDistance > 0
        ? this.props.minMarkerOverlapDistance
        : (this.props.minMarkerOverlapStepDistance || 1) * this.stepLength);
    var top =
      trueTop === 0
        ? 0
        : trueTop || this.props.sliderLength - this.props.markerSize / 2;
    var confined =
      unconfined < bottom ? bottom : unconfined > top ? top : unconfined;
    var slipDisplacement = this.props.touchDimensions.slipDisplacement;

    if (
      Math.abs(accumDistanceDisplacement) < slipDisplacement ||
      !slipDisplacement
    ) {
      var value = positionToValue(
        confined,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      var snapped = valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      this.setState({
        positionOne: this.props.snapped ? snapped : confined,
      });

      if (value !== this.state.valueOne) {
        this.setState(
          {
            valueOne: value,
          },
          () => {
            var change = [this.state.valueOne];
            if (this.state.valueTwo) {
              change.push(this.state.valueTwo);
            }
            this.props.onValuesChange(change);

            this.props.onMarkersPosition([
              this.state.positionOne,
              this.state.positionTwo,
            ]);
          },
        );
      }
    }
  };

  moveTwo = gestureState => {
    const accumDistance = this.props.vertical
      ? -gestureState.dy
      : gestureState.dx;
    const accumDistanceDisplacement = this.props.vertical
      ? gestureState.dx
      : gestureState.dy;

    const unconfined = I18nManager.isRTL
      ? this.state.pastTwo - accumDistance
      : accumDistance + this.state.pastTwo;
    var bottom =
      this.state.positionOne +
      (this.props.allowOverlap
        ? 0
        : this.props.minMarkerOverlapDistance > 0
        ? this.props.minMarkerOverlapDistance
        : (this.props.minMarkerOverlapStepDistance || 1) * this.stepLength);
    var top = this.props.sliderLength - this.props.markerSize / 2;
    var confined =
      unconfined < bottom ? bottom : unconfined > top ? top : unconfined;
    var slipDisplacement = this.props.touchDimensions.slipDisplacement;

    if (
      Math.abs(accumDistanceDisplacement) < slipDisplacement ||
      !slipDisplacement
    ) {
      var value = positionToValue(
        confined,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      var snapped = valueToPosition(
        value,
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );

      this.setState({
        positionTwo: this.props.snapped ? snapped : confined,
      });

      if (value !== this.state.valueTwo) {
        this.setState(
          {
            valueTwo: value,
          },
          () => {
            this.props.onValuesChange([
              this.state.valueOne,
              this.state.valueTwo,
            ]);

            this.props.onMarkersPosition([
              this.state.positionOne,
              this.state.positionTwo,
            ]);
          },
        );
      }
    }
  };

  endOne = gestureState => {
    if (gestureState.moveX === 0 && this.props.onToggleOne) {
      this.props.onToggleOne();
      return;
    }

    var snapped = valueToPosition(
      this.state.valueOne,
      this.optionsArray,
      this.props.sliderLength,
    );

    this.setState(
      {
        pastOne: this.props.smoothSnapped ? snapped : this.state.positionOne,
        ...(this.props.smoothSnapped ? { positionOne: snapped } : {}),
        onePressed: !this.state.onePressed,
      },
      () => {
        var change = [this.state.valueOne];
        if (this.state.valueTwo) {
          change.push(this.state.valueTwo);
        }
        this.props.onValuesChangeFinish(change);
      },
    );
  };

  endTwo = gestureState => {
    if (!this.props.enabledTwo) {
      return;
    }
    
    if (gestureState.moveX === 0 && this.props.onToggleTwo) {
      this.props.onToggleTwo();
      return;
    }

    var snapped = valueToPosition(
      this.state.valueTwo,
      this.optionsArray,
      this.props.sliderLength,
    );

    this.setState(
      {
        twoPressed: !this.state.twoPressed,
        pastTwo: this.props.smoothSnapped ? snapped : this.state.positionTwo,
        ...(this.props.smoothSnapped ? { positionTwo: snapped } : {}),
      },
      () => {
        this.props.onValuesChangeFinish([
          this.state.valueOne,
          this.state.valueTwo,
        ]);
      },
    );
  };

  componentDidUpdate(prevProps, prevState) {
    const {
      positionOne: prevPositionOne,
      positionTwo: prevPositionTwo,
    } = prevState;

    const { positionOne, positionTwo } = this.state;

    if (
      typeof positionOne === 'undefined' &&
      typeof positionTwo !== 'undefined'
    ) {
      return;
    }

    if (positionOne !== prevPositionOne || positionTwo !== prevPositionTwo) {
      this.props.onMarkersPosition([positionOne, positionTwo]);
    }

    if (this.state.onePressed || this.state.twoPressed) {
      return;
    }

    let nextState = {};
    if (
      prevProps.min !== this.props.min ||
      prevProps.max !== this.props.max ||
      prevProps.step !== this.props.step ||
      prevProps.values[0] !== this.props.values[0] ||
      prevProps.sliderLength !== this.props.sliderLength ||
      prevProps.values[1] !== this.props.values[1] ||
      (prevProps.sliderLength !== this.props.sliderLength &&
        prevProps.values[1])
    ) {
      this.optionsArray =
        this.props.optionsArray ||
        createArray(this.props.min, this.props.max, this.props.step);

      this.stepLength = this.props.sliderLength / this.optionsArray.length;

      const positionOne = valueToPosition(
        this.props.values[0],
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      nextState.valueOne = this.props.values[0];
      nextState.pastOne = positionOne;
      nextState.positionOne = positionOne;

      const positionTwo = valueToPosition(
        this.props.values[1],
        this.optionsArray,
        this.props.sliderLength,
        this.props.markerSize,
      );
      nextState.valueTwo = this.props.values[1];
      nextState.pastTwo = positionTwo;
      nextState.positionTwo = positionTwo;

      this.setState(nextState);
    }
  }

  getSteps() {
    const stepLength = this.props.sliderLength / (this.optionsArray.length - 1);
    const textStyles = [
      styles.stepLabel,
      this.props.stepLabelStyle,
      ...(this.props.vertical ? [{ transform: [{ rotate: '90deg' }] }] : []),
    ];
    const markerHeight = this.props?.trackStyle?.height || styles.track.height;
    const markerStyles = [
      styles.stepMarker,
      {
        height: markerHeight,
        width: markerHeight,
        borderRadius: markerHeight / 2,
      },
      this.props.stepMarkerStyle,
    ];

    return this.optionsArray.map((number, index) => {
      var step = this.stepsAs[index];
      return (
        <View
          key={number}
          style={[
            styles.step,
            this.props.stepStyle,
            { left: stepLength * index },
          ]}
        >
          {this.props.showStepMarkers &&
            index !== 0 &&
            index !== this.optionsArray.length - 1 && (
              <View style={markerStyles} />
            )}
          {this.props.showStepLabels && (
            <Text
              style={textStyles}
            >{`${step.prefix}${step.stepLabel}${step.suffix}`}</Text>
          )}
        </View>
      );
    });
  }

  render() {
    const { positionOne, positionTwo } = this.state;
    const {
      selectedStyle,
      unselectedStyle,
      trackStyle,
      sliderLength,
      markerOffsetX,
      markerOffsetY,
    } = this.props;
    const twoMarkers = this.props.values.length == 2; // when allowOverlap, positionTwo could be 0, identified as string '0' and throwing 'RawText 0 needs to be wrapped in <Text>' error

    const trackOneLength = positionOne;
    const trackOneStyle = twoMarkers
      ? unselectedStyle
      : selectedStyle || styles.selectedTrack;
    const trackThreeLength = twoMarkers ? sliderLength - positionTwo : 0;
    const trackThreeStyle = unselectedStyle;
    const trackFourStyle = this.props.loadingStyle ? this.props.loadingStyle : {};
    const trackFourLength = valueToPosition(
      this.props.loadingProgress,
      this.optionsArray,
      sliderLength,
      this.props.markerSize,
    ) - trackOneLength;
    const trackTwoLength = sliderLength - trackOneLength - trackThreeLength - trackFourLength;
    const trackTwoStyle = twoMarkers
      ? selectedStyle || styles.selectedTrack
      : unselectedStyle;
    const Marker = this.props.customMarker;

    const MarkerLeft = this.props.customMarkerLeft;
    const MarkerRight = this.props.customMarkerRight;
    const isMarkersSeparated = this.props.isMarkersSeparated || false;

    const Label = this.props.customLabel;

    const {
      slipDisplacement,
      height,
      width,
      borderRadius,
    } = this.props.touchDimensions;
    const touchStyle = {
      borderRadius: borderRadius || 0,
      ...(height && { height }),
      ...(width && { width }),
    };

    const markerContainerOne = {
      top: markerOffsetY - 24,
      left: trackOneLength + markerOffsetX - 24,
    };

    const markerContainerTwo = {
      top: markerOffsetY - 24,
      right: trackThreeLength + markerOffsetX - 24,
    };

    const containerStyle = [styles.container, this.props.containerStyle];

    if (this.props.vertical) {
      containerStyle.push({
        transform: [{ rotate: '-90deg' }],
      });
    }

    const body = (
      <React.Fragment>
        <View style={[styles.fullTrack, { width: sliderLength }]}>
          <View
            style={[
              styles.track,
              this.props.trackStyle,
              trackOneStyle,
              { width: trackOneLength },
            ]}
          />
          <View
            style={[
              styles.track,
              this.props.trackStyle,
              trackFourStyle,
              { width: trackFourLength },
            ]}
          />
          <View
            style={[
              styles.track,
              this.props.trackStyle,
              trackTwoStyle,
              { width: trackTwoLength },
            ]}
            {...(twoMarkers ? this._panResponderBetween.panHandlers : {})}
          />
          {twoMarkers && (
            <View
              style={[
                styles.track,
                this.props.trackStyle,
                trackThreeStyle,
                { width: trackThreeLength },
              ]}
            />
          )}
          {this.props.showSteps && this.getSteps()}
          <View
            style={[
              styles.markerContainer,
              markerContainerOne,
              this.props.markerContainerStyle,
              positionOne > sliderLength / 2 && styles.topMarkerContainer,
            ]}
          >
            <View
              style={[styles.touch, touchStyle]}
              ref={component => (this._markerOne = component)}
              {...this._panResponderOne.panHandlers}
            >
              {isMarkersSeparated === false ? (
                <Marker
                  enabled={this.props.enabledOne}
                  pressed={this.state.onePressed}
                  markerStyle={this.props.markerStyle}
                  pressedMarkerStyle={this.props.pressedMarkerStyle}
                  disabledMarkerStyle={this.props.disabledMarkerStyle}
                  currentValue={this.state.valueOne}
                  valuePrefix={this.props.valuePrefix}
                  valueSuffix={this.props.valueSuffix}
                />
              ) : (
                <MarkerLeft
                  enabled={this.props.enabledOne}
                  pressed={this.state.onePressed}
                  markerStyle={this.props.markerStyle}
                  pressedMarkerStyle={this.props.pressedMarkerStyle}
                  disabledMarkerStyle={this.props.disabledMarkerStyle}
                  currentValue={this.state.valueOne}
                  valuePrefix={this.props.valuePrefix}
                  valueSuffix={this.props.valueSuffix}
                />
              )}
            </View>
          </View>
          {twoMarkers && positionOne !== this.props.sliderLength && (
            <View
              style={[
                styles.markerContainer,
                markerContainerTwo,
                this.props.markerContainerStyle,
              ]}
            >
              <View
                style={[styles.touch, touchStyle]}
                ref={component => (this._markerTwo = component)}
                {...this._panResponderTwo.panHandlers}
              >
                {isMarkersSeparated === false ? (
                  <Marker
                    pressed={this.state.twoPressed}
                    markerStyle={this.props.markerStyle}
                    pressedMarkerStyle={this.props.pressedMarkerStyle}
                    disabledMarkerStyle={this.props.disabledMarkerStyle}
                    currentValue={this.state.valueTwo}
                    enabled={this.props.enabledTwo}
                    valuePrefix={this.props.valuePrefix}
                    valueSuffix={this.props.valueSuffix}
                  />
                ) : (
                  <MarkerRight
                    pressed={this.state.twoPressed}
                    markerStyle={this.props.markerStyle}
                    pressedMarkerStyle={this.props.pressedMarkerStyle}
                    disabledMarkerStyle={this.props.disabledMarkerStyle}
                    currentValue={this.state.valueTwo}
                    enabled={this.props.enabledTwo}
                    valuePrefix={this.props.valuePrefix}
                    valueSuffix={this.props.valueSuffix}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </React.Fragment>
    );

    return (
      <View testID={this.props.testID}>
        {this.props.enableLabel && (
          <Label
            oneMarkerValue={this.state.valueOne}
            twoMarkerValue={this.state.valueTwo}
            minValue={this.props.min}
            maxValue={this.props.max}
            oneMarkerLeftPosition={positionOne}
            twoMarkerLeftPosition={positionTwo}
            oneMarkerPressed={this.state.onePressed}
            twoMarkerPressed={this.state.twoPressed}
          />
        )}
        {/* when showing two thumb and with image background*/}
        {(this.props.imageBackgroundSource && twoMarkers) && (
          <ImageBackground
              source={this.props.imageBackgroundSource}
              style={[{width: '100%', height: '100%'}, containerStyle]}>
            {body}
          </ImageBackground>
        )}
        {/* when showing one thumb and with image background*/}
        {(this.props.imageBackgroundSource && !twoMarkers) && (
          <ImageBackground
              source={this.props.imageBackgroundSource}
              style={[{width: '100%', height: '100%'}, containerStyle]}
              {...(this.allowSliderClick ? this._panResponderOneTapped.panHandlers : {})}
          >
            {body}
          </ImageBackground>
        )}
        {/* when showing two thumb and without image background*/}
        {(!this.props.imageBackgroundSource && twoMarkers) && (
          <View style={[{backgroundColor: "#00000000"}, containerStyle]}
            ref={component => (this._markerOne = component)}>{body}</View>
        )}

        {/* when showing one thumb and without image background*/}
        {(!this.props.imageBackgroundSource && !twoMarkers) && (
          <View style={[{backgroundColor: "#00000000"}, containerStyle]}
                ref={component => (this._markerOne = component)}
                {...(this.props.allowSliderClick ? this._panResponderOneTapped.panHandlers : {})}
          >
            {body}
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: 50,
    justifyContent: 'center',
  },
  fullTrack: {
    flexDirection: 'row',
  },
  track: {
    ...Platform.select({
      ios: {
        height: 2,
        borderRadius: 2,
        backgroundColor: '#A7A7A7',
      },
      android: {
        height: 2,
        backgroundColor: '#CECECE',
      },
      web: {
        height: 2,
        borderRadius: 2,
        backgroundColor: '#A7A7A7',
      },
    }),
  },
  selectedTrack: {
    ...Platform.select({
      ios: {
        backgroundColor: '#095FFF',
      },
      android: {
        backgroundColor: '#0D8675',
      },
      web: {
        backgroundColor: '#095FFF',
      },
    }),
  },
  markerContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topMarkerContainer: {
    zIndex: 1,
  },
  touch: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  step: {
    position: 'absolute',
    marginLeft: -5,
  },
  stepMarker: {
    position: 'absolute',
    left: 2,
    width: 6,
    height: 6,
    backgroundColor: '#0000008c',
    borderRadius: 3,
  },
  stepLabel: {
    position: 'absolute',
    top: 15,
    color: '#333',
  },
});
