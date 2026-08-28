-- =============================================
-- Author:		<Pat Relos>
-- Create date: <2-21-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
CREATE PROCEDURE [dbo].[updateotherdeductiontoPS]
	-- Add the parameters for the stored procedure here
	@idpayroll nvarchar(20),
	@empid nvarchar(20),
	@idclient nvarchar(20),
	@iddepartment nvarchar(20),
	@datestart nvarchar(20)
		
AS	
BEGIN

--BEGIN TRANSACTION
	 --SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	--set @idpayroll = 2099
	--set @empid = 2099
	--set @idclient = 15
	--set @iddepartment = 105
    --set @datestart = '2022-12-01'
	
	DECLARE 
	@count int,
	@count2 int,
	@idpayrollsum nvarchar(10),
	@idpayrollsum2 nvarchar(10),
	@idpayrollsum2income nvarchar(10),
	@totalotherdeduction nvarchar(30),
	@totalotherdeduction2 nvarchar(30),
	@sss nvarchar(30),
	@philhealth nvarchar(30),
	@pagibig nvarchar(30),
	@wtax nvarchar(30),
	@totaldeduction nvarchar(30),
	@totaldeduction2 nvarchar(30),
	@netamount nvarchar(30),
	@netamount2 nvarchar(30),
	@totaladjustment nvarchar(30),
	@totaladjustment2 nvarchar(30),
	@totalsalary nvarchar(30),
	@TotalND nvarchar(30),
	@tardiness nvarchar(30),
	@gross nvarchar(30), 
	@grosstaxable nvarchar(30),
	
	--NIGH DIFF ITEM
	@regularnightshiftOT nvarchar(30),
	@LegalHolidayND nvarchar(30),
	@Holiday_Specialnightdiff nvarchar(30),
	
	--TOTAL OT ITEM
	@TotalOT nvarchar(30),
	@overtime nvarchar(30),
	@Legalholiday nvarchar(30),
	@LegalholidayOT nvarchar(30),
	@Holiday_Special nvarchar(30),
	@Holiday_SpecialOT nvarchar(30),
	@Nightdiff nvarchar(30),
	@SHonRDOT nvarchar(30),
	@LHonRDOT nvarchar(30),
	@RD nvarchar(30),
	@WDO nvarchar(30),
	@lhotnd nvarchar(30),
	@shotnd nvarchar(30),
	@Legalnowork nvarchar(30)
	



	
	--get the larges amount of gross ang get the id number 
	SELECT TOP 1  @idpayrollsum = idpayrollsum
	FROM  payroll_summary
	WHERE (Employee_id = @empid) AND (idclientp = @idclient) AND (department_codep = @iddepartment) AND (date_start = @datestart)
	ORDER BY grossamttaxable DESC

	--counting number of record  for other deduction check kung ilan ang laman
	SELECT @count=  count(*) from otherdeduction WHERE employee_id = @empid AND idclientdeduction = @idclient AND iddepartmentdeduction = @iddepartment AND Date_Start = @datestart
	
	--countring number of record for adjustment check kung ilan ang laman 
	SELECT @count2=  count(*) from adjustment WHERE employee_id = @empid AND idclientincome = @idclient AND iddepartmentincome = @iddepartment AND Date_Start = @datestart
	
	--- problem here if 2 records 

	SELECT @idpayrollsum2 = (CASE WHEN @count ='0' then @idpayrollsum WHEN @count ='1' then @idpayrollsum WHEN @count ='2' then @idpayrollsum  ELSE @idpayrollsum END) -- get the hight id number base on gross store to @idpayrollsum2 
	SELECT @idpayrollsum2income = (CASE WHEN @count2 ='0' then @idpayrollsum WHEN @count2 ='1' then @idpayrollsum WHEN @count2 ='2' then @idpayrollsum  ELSE '0' END) -- get the hight id number base on gross store to @idpayrollsum2 
	
	SELECT @totalotherdeduction=  COALESCE(Sum(amount),0) from otherdeduction WHERE idpayrollsum = @idpayroll
	SELECT @totalotherdeduction2= COALESCE(Sum(amount2),0) from otherdeduction WHERE idpayrollsum = @idpayroll
	
	SELECT @sss=contributionSSSEE from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @philhealth=contributionphilhealthEE from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @pagibig=contributionPagibigEE from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @wtax=Wtax from payroll_summary WHERE idpayrollsum = @idpayroll 

	
	declare @sql1 Nvarchar(max)
	declare @sql2 Nvarchar(max)
	declare @sql3 Nvarchar(max)
	declare @sql4 Nvarchar(max)--total deduction 
	declare @sql5 Nvarchar(max)--NETAMOUNT
	declare @sql6 Nvarchar(max)--NETAMOUNT2
	declare @sql7 Nvarchar(max)--NETAMOUNT2

	declare @sqlA1 Nvarchar(max)--update ID
	declare @sqlA2 Nvarchar(max)--adjustment
	declare @sqlA3 Nvarchar(max)--adjustmenttaxable amount
	declare @sqlA4 Nvarchar(max)-- gross
	declare @sqlA5 Nvarchar(max)--grosstaxable
	declare @sqlA6 Nvarchar(max)--TOTAL NIGH DIFFERENTIAL
	declare @sqlA7 Nvarchar(max)--TOTAL NIGH DIFFERENTIAL


	declare @mandatory0 Nvarchar(max)--sss convert to zero
	

 --create update query that update the idpayrollsum field of other deduction to connect the payroll summarry
	SET @sql1 = ('UPDATE otherdeduction SET idpayrollsum=' + @idpayrollsum2 + ' WHERE employee_id=' + @empid + ' AND idclientdeduction=' + @idclient + ' AND iddepartmentdeduction=' + @iddepartment + ' AND Date_Start=''' + @datestart + '''')
	EXECUTE(@sql1)
--adjustment	
	--create update query that update the idpayrollsum field of adjustment  to connect the payroll summarry
	SET @sqlA1 = ('UPDATE adjustment SET idpayrollsum=' + @idpayrollsum2income + ' WHERE employee_id=' + @empid + ' AND idclientincome=' + @idclient + ' AND iddepartmentincome=' + @iddepartment + ' AND Date_Start=''' + @datestart + '''')
	EXECUTE(@sqlA1)
	

	--value NEED TO RECOMPUTE GROSS
	SELECT @totaladjustment= COALESCE(Sum(amount),0) from adjustment WHERE idpayrollsum = @idpayroll
	SELECT @totaladjustment2= COALESCE(Sum(amounttaxable),0) from adjustment WHERE idpayrollsum =@idpayroll
	
	SELECT @totalsalary=Totalsalary from payroll_summary WHERE idpayrollsum = @idpayroll 
	

	----ALL NIGHT DIFF
	SELECT @regularnightshiftOT= regularnightshiftOT from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @LegalHolidayND= LegalHolidayND from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @Holiday_Specialnightdiff= Holiday_Specialnightdiff from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @TotalND= CAST(@regularnightshiftOT as float) +CAST(@LegalHolidayND AS FLOAT) + CAST(@Holiday_Specialnightdiff AS FLOAT)

	-- GET ALL TOTAL OT 
	
	SELECT @overtime= Overtime from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @Legalholiday= LegalHoliday from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @LegalHolidayOT= LegalHolidayOT from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @Holiday_Special= Holiday_Special from payroll_summary WHERE idpayrollsum = @idpayroll 
	SELECT @Holiday_SpecialOT= Holiday_SpecialOT from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @Nightdiff= Nightdiff from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @SHonRDOT= SHONRDOT from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @LHonRDOT= LHONRDOT from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @RD= RD from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @WDO= WDO from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @lhotnd= lhotnd from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @shotnd= shotnd from payroll_summary WHERE idpayrollsum = @idpayroll
	SELECT @legalnowork= legalnowork from payroll_summary WHERE idpayrollsum = @idpayroll
	
	
	
	SELECT @TotalOT= CAST(@overtime AS FLOAT)+CAST(@Legalholiday AS FLOAT)+CAST(@LegalholidayOT AS FLOAT)+CAST(@Holiday_Special AS FLOAT)+CAST(@Holiday_SpecialOT AS FLOAT)+CAST(@Nightdiff AS FLOAT)+CAST(@SHonRDOT AS FLOAT)+CAST(@LHonRDOT AS FLOAT)+CAST(@RD AS FLOAT)+CAST(@WDO AS FLOAT)+CAST(@lhotnd AS FLOAT)+CAST(@shotnd AS FLOAT)+CAST(@legalnowork AS FLOAT)
		
	SET @sqlA7 = ('UPDATE payroll_summary SET TotalOT=' + @TotalOT + ' WHERE idpayrollsum='+ @idpayroll + '')
	
		
	SELECT @tardiness= Tardiness from payroll_summary WHERE idpayrollsum = @idpayroll 
	--compute gross salary
	SELECT @gross = CAST(@totalsalary AS FLOAT)+CAST(@totaladjustment AS FLOAT)+CAST(@TotalOT as float)+cast(@totalND as float)-cast(@tardiness as float) 
	
	SELECT @grosstaxable = CAST(@totalsalary AS FLOAT)+CAST(@totaladjustment2 AS FLOAT)+CAST(@TotalOT as float)+cast(@totalND as float)-cast(@tardiness as float)

	
	
	--update amount and taxble amount of adjustment table 
	SET @sqlA2=('UPDATE payroll_summary SET adjustment=' + @totaladjustment + ' WHERE idpayrollsum='+ @idpayroll + '')
	SET @sqlA3=('UPDATE payroll_summary SET taxableadjustment=' + @totaladjustment2 + ' WHERE idpayrollsum='+ @idpayroll + '')
	SET @sqlA6=('UPDATE payroll_summary SET nightdifftotal=' + @TotalND + ' WHERE idpayrollsum='+ @idpayroll + '')
	SET @sqlA4=('UPDATE payroll_summary SET grossalary=' + @gross + ' WHERE idpayrollsum='+ @idpayroll + '')
	SET @sqlA5=('UPDATE payroll_summary SET grossamttaxable=' + @grosstaxable + ' WHERE idpayrollsum='+ @idpayroll + '')
	
	  	  
	if cast(@grosstaxable as float) <=1000
	BEGIN 
	SET @mandatory0 = ('UPDATE payroll_summary SET contributionSSSEE=0, 
					contributionphilhealthEE=0,  
					contributionSSSER=0, 
					contributionphilhealthER=0,  
					contributionPagibigEE=0,
					contributionPagibigER=0,
					contributionSSSECC=0
					WHERE idpayrollsum='+ @idpayroll + '')
	END 
	EXECUTE(@mandatory0)
	

	--other deduction
	--create update query that update amount of other deduction table  
	SET @sql2 = ('UPDATE payroll_summary SET other_deduction=' + @totalotherdeduction + ' WHERE idpayrollsum='+ @idpayroll + '')

	--create update query that update amount of other deduction table  	
	SET @sql3 = ('UPDATE payroll_summary SET other_deduction2=' + @totalotherdeduction2 + ' WHERE idpayrollsum='+ @idpayroll + '')
		
	--create update query that update Total Deduction amount 
	SELECT @totaldeduction = CAST(@totalotherdeduction AS FLOAT)+ CAST(@philhealth AS FLOAT)+ CAST(@sss AS FLOAT)+ CAST(@pagibig AS FLOAT)+ CAST(@wtax AS FLOAT)
	SET @sql4 = ('UPDATE payroll_summary SET totaldeduction=' + @totaldeduction + ' WHERE idpayrollsum='+ @idpayroll + '')
	
	SELECT @totaldeduction2 = CAST(@totalotherdeduction2 AS FLOAT)
	SET @sql5 = ('UPDATE payroll_summary SET other_deduction2=' + @totaldeduction2 + ' WHERE idpayrollsum='+ @idpayroll + '')

	--create update query that update Net amount 
	SELECT @netamount = CAST(@gross AS FLOAT)-CAST(@totaldeduction AS FLOAT)
	SET @sql6 = ('UPDATE payroll_summary SET netamount=' + @netamount + ' WHERE idpayrollsum='+ @idpayroll + '')

	--create update query that update Net amount2 
	SELECT @netamount2 = CAST(@netamount AS FLOAT)+CAST(@totaldeduction2 AS FLOAT)
	SET @sql7 = ('UPDATE payroll_summary SET netamount2=' + @netamount2 + ' WHERE idpayrollsum='+ @idpayroll + '')
		
	-- EXECUTE ALL INCOME
	
	EXECUTE(@sqlA2)
	EXECUTE(@sqlA3)
	EXECUTE(@sqlA4)
	EXECUTE(@sqlA5)
	EXECUTE(@sqlA6)
	EXECUTE(@sqlA7)
	
		   

	--EXECUTE ALL DEDUCTION

	EXECUTE(@sql2)
	EXECUTE(@sql3)
	EXECUTE(@sql4)
	EXECUTE(@sql5)
	
	--EXECUTE 2 NET AMOUNT 
	EXECUTE(@sql6)
	EXECUTE(@sql7)
	
END


		






