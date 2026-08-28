-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use to update sil >
-- =============================================
CREATE PROCEDURE  [dbo].[SIL]
	-- Add the parameters for the stored procedure here
		
		--@idclient int,
		@idemployee int
		--@yearcutt date
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	declare @noofhourswork float 
	declare @silrate float 
	declare @Dailyrate float 
	declare @sil float
	declare @silfinal float
	declare @idpayrollsum int
	declare @idemployee2 int
	declare @fetchedSilRate float
	declare @silytd float
	declare @datestart date
	
	DECLARE myCursor CURSOR FOR
   
   --per employee	
	select idpayrollsum,Employee_id, Date_Start, noofhourswork,dailyrate_payroll,Round(dailyrate_payroll*5/12/26.08/8,2) as silrate  from payroll_summary where Employee_id = @idemployee and thirteenmonthyear = 2023 order by Date_Start
	--All Per year 
	--select idpayrollsum, Employee_id, Date_Start,noofhourswork,dailyrate_payroll,Round(dailyrate_payroll*5/12/26.08/8,2) as silrate  from payroll_summary where thirteenmonthyear = 2023 order by Date_Start
	
	
	OPEN myCursor
   
	FETCH NEXT FROM myCursor INTO @idpayrollsum, @idemployee2,@datestart, @noofhourswork,@dailyrate ,@fetchedSilRate
	WHILE @@FETCH_STATUS = 0
	
		BEGIN
	
		--SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --Gross Basis
				
		select @silytd = coalesce(sum(silp),0) from payroll_summary where Employee_id = @idemployee2  and date_start <=@datestart 
	
		SET @sil = @noofhourswork * @fetchedSilRate;		
		UPDATE payroll_summary SET silp = @sil,silpytd= @silytd WHERE idpayrollsum = @idpayrollsum 
			   
		

	FETCH NEXT FROM myCursor INTO  @idpayrollsum, @idemployee2,@datestart, @noofhourswork,@dailyrate ,@fetchedSilRate
	END
	
	--select [sil]=@sil
	
	CLOSE myCursor
	DEALLOCATE myCursor


END
--exec [sil]
