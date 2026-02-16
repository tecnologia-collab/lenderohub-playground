import * as dinero from 'dinero.js'

class PercentageParseError extends Error {}

interface IPercentage {
  percentage: number
  precision: number
}

class Percentage implements IPercentage {
  percentage: number
  precision: number

  constructor (percentage: number, precision = 2) {
    this.percentage = percentage
    this.precision = precision
  }

  public multiply (amount: dinero.Dinero): dinero.Dinero {
    return amount.multiply(this.percentage).divide(100).divide(10 ** this.precision)
  }

  public toJSON (): IPercentage {
    return {
      percentage: this.percentage,
      precision: this.precision
    }
  }

  public toBSON (): IPercentage {
    return this.toJSON()
  }

  public toString (): string {
    const percentageString = `${this.percentage}`.padStart(this.precision, '0')
    const splitIndex = percentageString.length - this.precision
    const wholePart = percentageString.substring(0, splitIndex).padStart(1, '0')
    const fractionPart = percentageString.substring(splitIndex)
    return `${wholePart}.${fractionPart}`
  }

  public static fromString (str: string, precision = 2): Percentage {
    const regexp = new RegExp(`^(?<wholePart>\\d+)(\\.(?<fractionPart>\\d{1,${precision}}))?$`)
    const match = regexp.exec(str)
    if (match == null || match.groups == null) {
      throw new PercentageParseError()
    }
    const wholePart = match.groups.wholePart
    const fractionPart = (match.groups.fractionPart ?? '').padEnd(precision, '0')
    const intStr = `${wholePart}${fractionPart}`
    const percentage = parseInt(intStr)
    return new Percentage(percentage, precision)
  }
}

export {
  PercentageParseError,
  IPercentage,
  Percentage
}
