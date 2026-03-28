import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { ChevronDown, Check, X } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

interface ComboBoxProps {
    value: string;
    onChange: (value: string) => void;
    options: { name: string; color: string }[];
    placeholder?: string;
}

export function ComboBox({ value, onChange, options, placeholder = "Select..." }: ComboBoxProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const selectedOption = options.find((opt) => opt.name === value);

    return (
        <View className="relative z-50">
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleOpen}
                className="flex-row items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
            >
                <View className="flex-row items-center gap-2">
                    {selectedOption && (
                        <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedOption.color }}
                        />
                    )}
                    <Text className={`text-base ${selectedOption ? "text-slate-200" : "text-slate-400"}`}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </Text>
                </View>
                <ChevronDown size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <View className="flex-1 bg-black/60 justify-center">
                    <TouchableOpacity 
                        className="absolute inset-0" 
                        activeOpacity={1} 
                        onPress={() => setIsOpen(false)} 
                    />
                    <View className="bg-slate-900 border border-slate-800 mx-4 rounded-2xl overflow-hidden shadow-xl max-h-[70%]">
                        <View className="flex-row items-center justify-between p-4 border-b border-slate-800">
                            <Text className="text-lg font-semibold text-slate-200">Selecionar Matéria</Text>
                            <TouchableOpacity onPress={() => setIsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <X size={24} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => item.name}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isSelected = value === item.name;
                                return (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => handleSelect(item.name)}
                                        className={`flex-row items-center justify-between p-4 border-b border-slate-800/50 ${isSelected ? "bg-slate-800/80" : ""}`}
                                    >
                                        <View className="flex-row items-center gap-3">
                                            <View
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <Text className={`text-base ${isSelected ? "text-violet-400 font-medium" : "text-slate-300"}`}>
                                                {item.name}
                                            </Text>
                                        </View>
                                        {isSelected && <Check size={20} color={COLORS.violet} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
