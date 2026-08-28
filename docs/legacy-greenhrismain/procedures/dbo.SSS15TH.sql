-- =============================================
-- Author:		<Author,,Pat Relos>
-- Create date: <Create 3-17-2023>
-- Description:	<SSS update 15th of the month,,>
-- =============================================
create PROCEDURE [dbo].[SSS15TH]
	-- Add the parameters for the stored procedure here
	-- Add the parameters for the stored procedure here
--	@idpayroll nvarchar(20),
--	@empid nvarchar(20),
	@idclient1 nvarchar(20)
--	@iddepartment nvarchar(20),
--	@datestart nvarchar(20)

AS
BEGIN

-- set @idclient = 17
  
--SELECT TOP 1  @idclient = idclient
--FROM  client
--WHERE (idclient= @idclient)


   	
 DECLARE @idclient varchar(20) =17
 DECLARE @sssbasis varchar(20) = 'gross'
 DECLARE @datestart varchar(20) = '2023-02-01'

 DECLARE @idpayrollsummax varchar(20)
 DECLARE @idpayrollsum varchar(20)
 DECLARE @idemployee varchar(20)
 DECLARE @companyname VARCHAR(50)
 DECLARE @grosstaxable varchar(20)
 DECLARE @grosstaxablesum varchar(20)
 DECLARE @basic varchar(20)
 DECLARE @counter int =0
 DECLARE @sssee varchar(20)
 DECLARE @ssser varchar(20)
 DECLARE @sssecc varchar(20)

 -- sql to be run 
 declare @sqlsss Nvarchar(max)
 
  DECLARE myCursor CURSOR FOR
     
	SELECT idpayrollsum,Employee_id, companyname2, grossamttaxable, basic FROM payroll_summary where idclientp = @idclient and Date_Start = '2023-02-01'
   
	OPEN myCursor
   
	FETCH NEXT FROM myCursor INTO @idpayrollsum, @idemployee, @companyname, @grosstaxable, @basic
   
   --here is the process of updatating
   WHILE @@FETCH_STATUS = 0
	BEGIN
      -- process the current row
   	        
      -- fetch the next row
		if @sssbasis = 'Gross'
		BEGIN
			-- get idpayrollsum with highest grossamt
			SELECT TOP 1  @idpayrollsummax = idpayrollsum
			FROM  payroll_summary
			WHERE Employee_id = @idemployee AND idclientp = @idclient  AND date_start = @datestart
			ORDER BY grossamttaxable DESC
		
			SELECT @grosstaxablesum =  COALESCE(Sum(grossamttaxable),0)  FROM  payroll_summary
			WHERE Employee_id = @idemployee AND idclientp = @idclient  AND date_start = @datestart
				
			SELECT top 1 @sssee=EmployeeSSS from sss WHERE Range <= @grosstaxablesum order by Range desc
			SELECT top 1 @ssser=EmployerSSS from sss WHERE Range <= @grosstaxablesum order by Range desc
			SELECT top 1 @sssecc=@sssecc from sss WHERE Range <= @grosstaxablesum order by Range desc
			
			
			SET @counter = @counter + 1
			PRINT @idpayrollsum+' '+ @idpayrollsummax
			if @idpayrollsummax  = @idpayrollsum  -- meaning get the max
			BEGIN								
				print @counter
				print 'sss: '+@sssee
				PRINT @idpayrollsum +' '+ @idemployee +' '+ @companyname+' '+ @grosstaxable +' '+ @grosstaxableSUM +' '+ @sssbasis  +' '+ @idpayrollsummax
			
			--update the sss employee
				SET @sqlsss = ('UPDATE payroll_summary SET contributionSSSEE=' + @sssee + ',contributionSSSER=' + @ssser + ',contributionSSSECC=' + @sssecc + '   WHERE idpayrollsum=2283')
				EXECUTE(@sqlsss)
			END
			ELSE 
			BEGIN
				print @counter
				print 'sss: ' +'0' 
				PRINT @idpayrollsum +' '+ @idemployee +' '+ @companyname+' '+ @grosstaxable +' '+ @grosstaxableSUM +' '+ @sssbasis  +' '+ @idpayrollsummax
			--update the sss employee
				SET @sqlsss = ('UPDATE payroll_summary SET contributionSSSEE=' + '0' + ',contributionSSSER=' + '0' + ',contributionSSSECC=' + '0' + '   WHERE idpayrollsum='+ @idpayrollsum + '')
				EXECUTE(@sqlsss)						
			END
		END
	
	else 
	   	-------------------------- basic basis---------------------------------
		BEGIN
			-- get idpayrollsum with highest grossamt
			SELECT TOP 1  @idpayrollsummax = idpayrollsum
			FROM  payroll_summary
			WHERE Employee_id = @idemployee AND idclientp = @idclient  AND date_start = @datestart
			ORDER BY grossamttaxable DESC
		
			SELECT @grosstaxablesum =  COALESCE(Sum(basic),0)  FROM  payroll_summary
			WHERE Employee_id = @idemployee AND idclientp = @idclient  AND date_start = @datestart
				
			SELECT top 1 @sssee=EmployeeSSS from sss WHERE Range <= @grosstaxablesum order by Range desc
			SELECT top 1 @ssser=EmployerSSS from sss WHERE Range <= @grosstaxablesum order by Range desc
			SELECT top 1 @sssecc=@sssecc from sss WHERE Range <= @grosstaxablesum order by Range desc
			
			
			SET @counter = @counter + 1
			PRINT @idpayrollsum+' '+ @idpayrollsummax
			if  @idpayrollsum = @idpayrollsummax -- meaning get the max
			BEGIN
				
				--PRINT @idpayrollsum+' '+ @companyname+' '+ @grosstaxable
				--print @counter
				--print 'sss: '+@sssee
				--PRINT @idpayrollsum +' '+ @idemployee +' '+ @companyname+' '+ @grosstaxable +' '+ @grosstaxableSUM +' '+ @sssbasis  +' '+ @idpayrollsummax
			
			--update the sss employee
				SET @sqlsss = ('UPDATE payroll_summary SET contributionSSSEE=' + @sssee + ',contributionSSSER=' + @ssser + ',contributionSSSECC=' + @sssecc + '   WHERE idpayrollsum='+ @idpayrollsum + '')
				execute(@sqlsss)
			END
		ELSE 
			BEGIN
				--print @counter
				--print 'sss: ' +'0' 
				--PRINT @idpayrollsum +' '+ @idemployee +' '+ @companyname+' '+ @grosstaxable +' '+ @grosstaxableSUM +' '+ @sssbasis  +' '+ @idpayrollsummax
			--update the sss employee
				SET @sqlsss = ('UPDATE payroll_summary SET contributionSSSEE=' + '0' + ',contributionSSSER=' + '0' + ',contributionSSSECC=' + '0' + '   WHERE idpayrollsum='+ @idpayrollsum + '')
				execute(@sqlsss)					
			END
		END
     
   FETCH NEXT FROM myCursor INTO @idpayrollsum, @idemployee, @companyname, @grosstaxable,@basic
   END

   CLOSE myCursor
   DEALLOCATE myCursor
   	 
END



