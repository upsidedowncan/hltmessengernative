import { Button, CircularProgress, Chip, LinearProgress, Picker, Slider, Switch, TextInput } from "@expo/ui/jetpack-compose";
import React, { useState } from 'react';

export default function AiScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [value, setValue] = useState<number>(0);
  const [checked, setChecked] = useState(false);
  const [inputValue, setInputValue] = useState('');
  

  return (
    <>
      <Button
        leadingIcon="outlined.Edit"
        variant="elevated"
      >
        AI Feature Coming Soon!
      </Button>
      <CircularProgress style={{ width: 50 }} elementColors={{ trackColor: '#cccccc' }} />
      <Chip
        variant="assist"
        label="Book"
        leadingIcon="filled.Add"
      />

      <Chip
        variant="filter"
        label="Images"
        leadingIcon="filled.Star"
      />
      <Chip
        variant="input"
        label="Work"
        leadingIcon="filled.Create"
      />

      <Chip
        variant="suggestion"
        label="Nearby"
        leadingIcon="filled.LocationOn"
        onPress={() => console.log('Searching nearby...')}
      />
      <LinearProgress style={{ width: 300 }} />
      <Picker
        options={['$', '$$', '$$$', '$$$$']}
        selectedIndex={selectedIndex}
        onOptionSelected={({ nativeEvent: { index } }) => {
          setSelectedIndex(index);
        }}
        variant="radio"
      />

      <Picker
        options={['$', '$$', '$$$', '$$$$']}
        selectedIndex={selectedIndex}
        onOptionSelected={({ nativeEvent: { index } }) => {
          setSelectedIndex(index);
        }}
        variant="segmented"
      />
      <Slider
        style={{ minHeight: 60 }}
        value={value}
        onValueChange={(value) => {
          setValue(value);
        }}
      />
      <Switch
        value={checked}
        onValueChange={checked => {
          setChecked(checked);
        }}
        label="Play music"
        variant="switch"
      />

      <Switch
        value={checked}
        onValueChange={checked => {
          setChecked(checked);
        }}
        label="Play music"
        variant="checkbox"
      />
      <TextInput autocorrection={false} defaultValue="A single line text input" onChangeText={setInputValue} autoCapitalize="words" />
    </>

  );
}